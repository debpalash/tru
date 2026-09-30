import type { XMedia } from './types'
import { serviceFetch, serviceHasMedia } from '../service/connection'
import { privacyFetch } from '../privacy/transport'

const HF_BASE = 'https://router.huggingface.co/hf-inference/models'
const PRIMARY_MODEL = 'Falconsai/nsfw_image_detection'
const FALLBACK_MODEL = 'Freepik/nsfw_image_detector'
const EXTRA_MODEL = 'giacomoarienti/nsfw-classifier'
const UNSAFE_THRESHOLD = 0.3
const FETCH_TIMEOUT_MS = 12_000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_CACHE = 512

export type XMediaSafety = 'safe' | 'unsafe' | 'unavailable'
type Label = { label: string; score: number }
type ImagePayload = { bytes: Uint8Array; mimeType: string }

const cache = new Map<string, XMediaSafety>()
const inflight = new Map<string, Promise<XMediaSafety>>()
const queue: Array<() => void> = []
let active = 0
const MAX_CONCURRENT_POSTS = 2

function validScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function remember(key: string, verdict: Exclude<XMediaSafety, 'unavailable'>): void {
  cache.delete(key)
  cache.set(key, verdict)
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

function runQueued<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1
      void task().then(resolve, reject).finally(() => {
        active -= 1
        queue.shift()?.()
      })
    }
    if (active < MAX_CONCURRENT_POSTS) run()
    else queue.push(run)
  })
}

export function isTrustedXMediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && (url.hostname === 'pbs.twimg.com' || url.hostname.endsWith('.twimg.com'))
  } catch {
    return false
  }
}

export function xMediaPreviewUrl(raw: string): string {
  const url = new URL(raw)
  // X's `name` transform applies to media assets only. Adding it to profile,
  // banner, or video-thumbnail URLs returns 404 from pbs.twimg.com.
  if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) url.searchParams.set('name', 'small')
  return url.toString()
}

export function xMediaFullUrl(raw: string): string {
  const url = new URL(raw)
  if (url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) url.searchParams.set('name', 'orig')
  return url.toString()
}

async function fetchBytes(raw: string): Promise<ImagePayload | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await privacyFetch(xMediaPreviewUrl(raw), { signal: controller.signal }, FETCH_TIMEOUT_MS)
    if (!response.ok) return null
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (declared > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null
    const responseType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const mimeType = responseType?.startsWith('image/') ? responseType : 'image/jpeg'
    return { bytes, mimeType }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0
    const b = bytes[index + 1] ?? 0
    const c = bytes[index + 2] ?? 0
    const word = (a << 16) | (b << 8) | c
    output += alphabet[(word >>> 18) & 63]
    output += alphabet[(word >>> 12) & 63]
    output += index + 1 < bytes.length ? alphabet[(word >>> 6) & 63] : '='
    output += index + 2 < bytes.length ? alphabet[word & 63] : '='
  }
  return output
}

async function classifyWithGemini(image: ImagePayload): Promise<XMediaSafety> {
  if (!serviceHasMedia()) return 'unavailable'
  try {
    const response = await serviceFetch('/v1/media', { mimeType: image.mimeType, data: bytesToBase64(image.bytes) }, AbortSignal.timeout(FETCH_TIMEOUT_MS))
    if (!response.ok) return 'unavailable'
    const result = await response.json()
    return result.verdict === 'safe' ? 'safe' : result.verdict === 'unsafe' ? 'unsafe' : 'unavailable'
  } catch { return 'unavailable' }
}

export function falconsaiScore(labels: Label[]): number | null {
  let unsafe = 0
  let safe = 0
  for (const row of labels) {
    const label = row.label.toLowerCase()
    if (label.includes('nsfw') || label === 'unsafe' || label === 'porn') unsafe = Math.max(unsafe, row.score)
    if (label.includes('normal') || label.includes('sfw') || label === 'safe') safe = Math.max(safe, row.score)
  }
  if (!unsafe && !safe) return null
  return unsafe || Math.max(0, 1 - safe)
}

export function freepikScore(labels: Label[]): number | null {
  const scores = Object.fromEntries(labels.map((row) => [row.label.toLowerCase(), row.score]))
  const high = scores.high ?? 0
  const medium = scores.medium ?? 0
  const low = scores.low ?? 0
  if (high + medium + low < 0.05) return 0.05
  return Math.min(1, Math.max(high >= 0.25 ? 0.9 : 0, medium >= 0.4 ? 0.58 : medium >= 0.28 ? 0.45 : medium * 0.7, low * 0.35))
}

export function giacomoScore(labels: Label[]): number | null {
  const scores = Object.fromEntries(labels.map((row) => [row.label.toLowerCase(), row.score]))
  const porn = scores.porn ?? 0
  const hentai = scores.hentai ?? 0
  const sexy = scores.sexy ?? 0
  if (!labels.length) return null
  let unsafe = Math.min(1, porn + hentai + sexy * 1.6)
  if (porn >= 0.15 || hentai >= 0.15) unsafe = Math.max(unsafe, 0.88)
  if (sexy >= 0.2) unsafe = Math.max(unsafe, 0.72)
  else if (sexy >= 0.08) unsafe = Math.max(unsafe, 0.55)
  return unsafe
}

async function scanOne(media: XMedia): Promise<XMediaSafety> {
  if (!serviceHasMedia() || !isTrustedXMediaUrl(media.previewUrl)) return 'unavailable'
  const image = await fetchBytes(media.previewUrl)
  if (!image) return 'unavailable'

  return classifyWithGemini(image)
}

async function scanPost(media: readonly XMedia[]): Promise<XMediaSafety> {
  if (!media.length) return 'safe'
  for (const item of media) {
    const result = await scanOne(item)
    if (result !== 'safe') return result
  }
  return 'safe'
}

export function verifyXMedia(media: readonly XMedia[]): Promise<XMediaSafety> {
  const key = media.map((item) => item.previewUrl).join('|')
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const running = inflight.get(key)
  if (running) return running
  const promise = runQueued(() => scanPost(media)).then((verdict) => {
    if (verdict !== 'unavailable') remember(key, verdict)
    return verdict
  }).finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}
