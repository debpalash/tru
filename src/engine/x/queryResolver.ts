import { privacyFetch } from '../privacy/transport'

const PAGES = ['https://x.com/home', 'https://x.com/explore', 'https://x.com'] as const
const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_BUNDLES = 12
const FETCH_TIMEOUT_MS = 7_000

const ids = new Map<string, string>()
let bundleText = ''
let bundleAt = 0

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await privacyFetch(url, { signal: controller.signal, credentials: 'omit' }, FETCH_TIMEOUT_MS)
    return response.ok ? await response.text() : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export function extractXBundleUrls(html: string): string[] {
  const found = html.match(/https:\/\/abs\.twimg\.com\/responsive-web\/[^"'\s)]+?\.js/g) ?? []
  return [...new Set(found)].filter((url) => {
    try { return new URL(url).hostname === 'abs.twimg.com' } catch { return false }
  })
}

export function extractXQueryId(bundle: string, operationName: string): string | null {
  if (!bundle || !operationName) return null
  const operation = operationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const id = '([a-zA-Z0-9_-]{16,})'
  for (const pattern of [
    new RegExp(`queryId:"${id}"[^}]*?operationName:"${operation}"`),
    new RegExp(`operationName:"${operation}"[^}]*?queryId:"${id}"`),
    new RegExp(`"${operation}"[^}]*?"queryId":"${id}"`),
  ]) {
    const match = bundle.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

async function loadBundles(): Promise<string> {
  if (bundleText && Date.now() - bundleAt < CACHE_TTL_MS) return bundleText
  let html = ''
  let urls: string[] = []
  for (const page of PAGES) {
    html = await fetchText(page)
    urls = extractXBundleUrls(html)
    if (urls.length) break
  }
  let combined = html
  const ordered = urls.sort((a, b) => Number(/(?:api|main|endpoints)/.test(b)) - Number(/(?:api|main|endpoints)/.test(a)))
  for (const url of ordered.slice(0, MAX_BUNDLES)) {
    const source = await fetchText(url)
    if (source) combined += `\n${source}`
    if (combined.includes('operationName') && combined.includes('queryId')) break
  }
  if (combined.includes('operationName') && combined.includes('queryId')) {
    bundleText = combined
    bundleAt = Date.now()
  }
  return combined
}

export async function resolveXQueryId(operationName: string): Promise<string | null> {
  const cached = ids.get(operationName)
  if (cached) return cached
  try {
    const id = extractXQueryId(await loadBundles(), operationName)
    if (id) ids.set(operationName, id)
    return id
  } catch {
    return null
  }
}

export function rememberXQueryId(operationName: string, queryId: string): void {
  if (operationName && queryId) ids.set(operationName, queryId)
}

/** Public web-app authorization is discovered at runtime, never shipped as a credential. */
export async function resolveXBearerToken(): Promise<string | null> {
  const bundle = await loadBundles()
  const token = bundle.match(/AAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%_-]{60,180}/)?.[0]
  return token ? `Bearer ${token}` : null
}
