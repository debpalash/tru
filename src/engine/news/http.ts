// Bounded network helpers for the news sources. Every fetch has a hard timeout
// (AbortController) so a hung source can't wedge the aggregator, and `settle`
// converts any rejection/timeout into a fallback value so one dead source
// degrades to [] instead of crashing the whole tab.

import { privacyFetch } from '../privacy/transport'

const DEFAULT_TIMEOUT_MS = 12_000

// A desktop-ish UA because some sites (Product Hunt) return a barebones/blocked body
// to unknown agents. Kept minimal and honest.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/** GET a URL as text with a hard timeout. Throws on non-2xx or timeout. */
export async function fetchText(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  headers?: Record<string, string>
): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await privacyFetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    }, timeoutMs)
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Resolve `p`, but never reject and never take longer than `timeoutMs`: on
 * error OR timeout, resolve with `fallback`. Mirrors the app's `settleWithTimeout`
 * spirit so a slow/failing source can't stall a `Promise.all` of sources.
 */
export async function settle<T>(
  p: Promise<T>,
  fallback: T,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const guard = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs)
  })
  try {
    return await Promise.race([p.catch(() => fallback), guard])
  } finally {
    clearTimeout(timer!)
  }
}
