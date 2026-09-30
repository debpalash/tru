import { trustedPublisherForUrl, trustedSearchDomains } from '../news/registry'
import { isGeneralAudienceNews } from '../news/safety'
import { serviceFetch, serviceHasWeb } from '../service/connection'
import type { EvidenceRole, NewsItem } from '../news/types'

type SecureStoreModule = typeof import('expo-secure-store')

const API_BASE = 'https://api.firecrawl.dev/v2'
const STORAGE_KEY = 'tru.firecrawl.usage.v1'
const REQUEST_TIMEOUT_MS = 20_000

/** A deliberate device-side guardrail below Firecrawl's advertised free allocation. */
export const FIRECRAWL_DAILY_CREDIT_LIMIT = 40
export const FIRECRAWL_MONTHLY_CREDIT_LIMIT = 400
export const FIRECRAWL_SEARCH_CREDITS = 2
export const FIRECRAWL_SCRAPE_CREDITS = 1

interface UsageLedger {
  day: string
  dayCredits: number
  month: string
  monthCredits: number
}

export interface FirecrawlUsage {
  dayCredits: number
  dailyLimit: number
  monthCredits: number
  monthlyLimit: number
  mode: 'disconnected' | 'service'
  availability: 'untested' | 'available' | 'unavailable'
  detail?: string
}

export interface TrustedWebResult {
  id: string
  publisherId: string
  publisher: string
  short: string
  role: EvidenceRole
  title: string
  description?: string
  url: string
  position?: number
}

export interface FirecrawlSearchResult {
  results: TrustedWebResult[]
  usage: FirecrawlUsage
  credits: number
}

export type FirecrawlErrorCode = 'quota' | 'rate-limit' | 'network-blocked' | 'request' | 'invalid-response'

export class FirecrawlError extends Error {
  constructor(public readonly code: FirecrawlErrorCode, message: string) {
    super(message)
    this.name = 'FirecrawlError'
  }
}

let ledger: UsageLedger | null = null
let quotaQueue: Promise<unknown> = Promise.resolve()
let availability: FirecrawlUsage['availability'] = 'untested'
let availabilityDetail: string | undefined

function secureStore(): SecureStoreModule | null {
  try {
    return require('expo-secure-store') as SecureStoreModule
  } catch {
    return null
  }
}

function periodKeys(now = Date.now()): { day: string; month: string } {
  const iso = new Date(now).toISOString()
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) }
}

export function normalizeFirecrawlLedger(value: unknown, now = Date.now()): UsageLedger {
  const periods = periodKeys(now)
  const candidate = value && typeof value === 'object' ? value as Partial<UsageLedger> : {}
  return {
    day: periods.day,
    dayCredits: candidate.day === periods.day && Number.isFinite(candidate.dayCredits)
      ? Math.max(0, Math.floor(candidate.dayCredits ?? 0))
      : 0,
    month: periods.month,
    monthCredits: candidate.month === periods.month && Number.isFinite(candidate.monthCredits)
      ? Math.max(0, Math.floor(candidate.monthCredits ?? 0))
      : 0,
  }
}

async function loadLedger(): Promise<UsageLedger> {
  if (ledger) {
    ledger = normalizeFirecrawlLedger(ledger)
    return ledger
  }
  try {
    const raw = await secureStore()?.getItemAsync(STORAGE_KEY)
    ledger = normalizeFirecrawlLedger(raw ? JSON.parse(raw) : null)
  } catch {
    ledger = normalizeFirecrawlLedger(null)
  }
  return ledger
}

function usageFromLedger(current: UsageLedger): FirecrawlUsage {
  return {
    dayCredits: current.dayCredits,
    dailyLimit: FIRECRAWL_DAILY_CREDIT_LIMIT,
    monthCredits: current.monthCredits,
    monthlyLimit: FIRECRAWL_MONTHLY_CREDIT_LIMIT,
    mode: serviceHasWeb() ? 'service' : 'disconnected',
    availability,
    detail: availabilityDetail,
  }
}

function withQuotaLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = quotaQueue.then(operation, operation)
  quotaQueue = result.then(() => undefined, () => undefined)
  return result
}

export function getFirecrawlUsage(): Promise<FirecrawlUsage> {
  return withQuotaLock(async () => usageFromLedger(await loadLedger()))
}

async function reserveCredits(cost: number): Promise<FirecrawlUsage> {
  return withQuotaLock(async () => {
    const current = await loadLedger()
    if (current.dayCredits + cost > FIRECRAWL_DAILY_CREDIT_LIMIT) {
      throw new FirecrawlError('quota', 'Tru’s daily web allowance is used. Direct feeds and saved stories still work.')
    }
    if (current.monthCredits + cost > FIRECRAWL_MONTHLY_CREDIT_LIMIT) {
      throw new FirecrawlError('quota', 'Tru’s monthly web allowance is used. Direct feeds and saved stories still work.')
    }
    ledger = {
      ...current,
      dayCredits: current.dayCredits + cost,
      monthCredits: current.monthCredits + cost,
    }
    try {
      await secureStore()?.setItemAsync(STORAGE_KEY, JSON.stringify(ledger))
    } catch {
      // The in-memory guardrail remains active for this app session.
    }
    return usageFromLedger(ledger)
  })
}

async function releaseCredits(cost: number): Promise<void> {
  await withQuotaLock(async () => {
    const current = await loadLedger()
    ledger = {
      ...current,
      dayCredits: Math.max(0, current.dayCredits - cost),
      monthCredits: Math.max(0, current.monthCredits - cost),
    }
    try {
      await secureStore()?.setItemAsync(STORAGE_KEY, JSON.stringify(ledger))
    } catch {
      // The in-memory counter is still corrected.
    }
  })
}

function readableApiError(status: number, detail: string): FirecrawlError {
  if (/suspicious|without an api key/i.test(detail)) {
    return new FirecrawlError(
      'network-blocked',
      'Web research is unavailable on this service. Direct sources still work.',
    )
  }
  if (status === 429) {
    return new FirecrawlError(
      'rate-limit',
      'The web service allowance is currently exhausted. Direct sources still work.',
    )
  }
  return new FirecrawlError('request', detail || `Firecrawl request failed (${status}).`)
}

async function postFirecrawl(path: string, body: object, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await serviceFetch(`/v1/web${path}`, body, controller.signal)
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      throw new FirecrawlError('invalid-response', 'Firecrawl returned an unreadable response.')
    }
    const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    if (!response.ok || record?.success !== true) {
      const detail = typeof record?.error === 'string' ? record.error : ''
      availability = 'unavailable'
      const apiError = readableApiError(response.status, detail)
      availabilityDetail = apiError.message
      throw apiError
    }
    availability = 'available'
    availabilityDetail = undefined
    return parsed
  } catch (error) {
    if (error instanceof FirecrawlError) throw error
    if (signal?.aborted) throw error
    if (controller.signal.aborted) {
      availability = 'unavailable'
      availabilityDetail = 'Firecrawl did not respond in time. Direct Tru sources still work.'
      throw new FirecrawlError('request', availabilityDetail)
    }
    availability = 'unavailable'
    availabilityDetail = 'Firecrawl could not be reached. Direct Tru sources still work.'
    throw new FirecrawlError('request', availabilityDetail)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function stableId(url: string): string {
  let hash = 2166136261
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, maxLength) : undefined
}

function parseSearchResults(payload: unknown): TrustedWebResult[] {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {}
  const web = Array.isArray(data.web) ? data.web : []
  const seen = new Set<string>()
  const results: TrustedWebResult[] = []

  for (const entry of web) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url : ''
    const title = cleanText(record.title, 300)
    const publisher = trustedPublisherForUrl(url)
    if (!publisher || !title || seen.has(url)) continue
    const candidate: TrustedWebResult = {
      id: `firecrawl:${stableId(url)}`,
      publisherId: publisher.id,
      publisher: publisher.name,
      short: publisher.short,
      role: publisher.evidenceRole,
      title,
      description: cleanText(record.description ?? record.snippet, 1_600),
      url,
      position: typeof record.position === 'number' ? record.position : undefined,
    }
    if (!isGeneralAudienceNews(trustedWebResultToNewsItem(candidate))) continue
    seen.add(url)
    results.push(candidate)
  }
  return results
}

export async function searchTrustedWeb(
  query: string,
  options: { limit?: number; recency?: 'day' | 'week' | 'month'; signal?: AbortSignal } = {},
): Promise<FirecrawlSearchResult> {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim().slice(0, 320)
  if (!normalizedQuery) throw new FirecrawlError('request', 'A search query is required.')
  const limit = Math.min(10, Math.max(1, Math.floor(options.limit ?? 8)))
  const cost = Math.ceil(limit / 10) * FIRECRAWL_SEARCH_CREDITS
  const usage = await reserveCredits(cost)
  const recency = options.recency ?? 'week'
  const tbs = recency === 'day' ? 'qdr:d' : recency === 'month' ? 'qdr:m' : 'qdr:w'
  let payload: unknown
  try {
    payload = await postFirecrawl('/search', {
      query: normalizedQuery,
      limit,
      sources: ['web'],
      includeDomains: trustedSearchDomains(),
      tbs,
      safe: true,
      highlights: false,
      timeout: 15_000,
    }, options.signal)
  } catch (error) {
    await releaseCredits(cost)
    throw error
  }
  return { results: parseSearchResults(payload), usage, credits: cost }
}

function markdownExcerpt(markdown: string): string | undefined {
  return cleanText(
    markdown
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/[`#>*_|~]+/g, ' '),
    1_800,
  )
}

export async function scrapeTrustedPage(url: string, signal?: AbortSignal): Promise<string | undefined> {
  if (!trustedPublisherForUrl(url)) {
    throw new FirecrawlError('request', 'Tru only extracts pages from its pinned publisher domains.')
  }
  await reserveCredits(FIRECRAWL_SCRAPE_CREDITS)
  let payload: unknown
  try {
    payload = await postFirecrawl('/scrape', {
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      parsers: [],
      maxAge: 600_000,
      timeout: 15_000,
    }, signal)
  } catch (error) {
    await releaseCredits(FIRECRAWL_SCRAPE_CREDITS)
    throw error
  }
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {}
  return typeof data.markdown === 'string' ? markdownExcerpt(data.markdown) : undefined
}

export function trustedWebResultToNewsItem(result: TrustedWebResult, excerpt?: string): NewsItem {
  return {
    id: result.id,
    sourceId: result.publisherId,
    title: result.title,
    url: result.url,
    hover: excerpt ?? result.description,
  }
}

export async function researchTrustedWeb(
  query: string,
  signal?: AbortSignal,
): Promise<{ items: NewsItem[]; credits: number; usage: FirecrawlUsage }> {
  const search = await searchTrustedWeb(query, { limit: 8, recency: 'week', signal })
  const selected = search.results.slice(0, 2)
  const scrapes = await Promise.all(selected.map(async (result) => {
    try {
      return { excerpt: await scrapeTrustedPage(result.url, signal), charged: true }
    } catch (error) {
      if (signal?.aborted) throw error
      return { excerpt: undefined, charged: false }
    }
  }))
  const items = search.results.map((result, index) =>
    trustedWebResultToNewsItem(result, index < scrapes.length ? scrapes[index]?.excerpt : undefined),
  )
  return {
    items,
    credits: search.credits + scrapes.filter((scrape) => scrape.charged).length * FIRECRAWL_SCRAPE_CREDITS,
    usage: await getFirecrawlUsage(),
  }
}
