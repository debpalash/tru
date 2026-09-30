import { proxyRequest } from '../../../modules/proxy-http'

import { activeProxy, isProxyPreferenceOn, isProxyReady, reportProxyResult } from './proxyPool'
import { canRelayPublicUrl, relayPublicUrl } from './relay'
import { isTorEnabled, isTorReady, TOR_HTTP_PROXY_PORT, TOR_PROXY_HOST, torStatus } from './tor'

export class PrivacyRouteError extends Error {
  constructor(message: string) { super(message); this.name = 'PrivacyRouteError' }
}

function hostOf(raw: string): string {
  try { return new URL(raw).hostname.toLowerCase() } catch { return '' }
}
function isXHost(host: string): boolean {
  return host === 'x.com' || host.endsWith('.x.com')
    || host === 'twitter.com' || host.endsWith('.twitter.com')
    || host === 'twimg.com' || host.endsWith('.twimg.com')
}
function headersRecord(input?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {}
  if (!input) return result
  new Headers(input).forEach((value, key) => { result[key] = value })
  return result
}
function containsCredentials(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => ['authorization', 'cookie', 'x-csrf-token'].includes(key.toLowerCase()))
}
function responseFrom(body: string, status: number): Response {
  return new Response([204, 205, 304].includes(status) ? null : body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

/** Network policy for API/text traffic. Enabled private routes fail closed. */
export async function privacyFetch(raw: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  if (!/^https?:\/\//i.test(raw)) return fetch(raw, init)
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const host = hostOf(raw)
  const headers = headersRecord(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()
  const body = typeof init.body === 'string' ? init.body : null
  const hasUnsupportedPrivateBody = init.body != null && typeof init.body !== 'string'

  // Tor is the strongest route and wins if users also leave the X pool on.
  if (isXHost(host) && isProxyPreferenceOn() && !isTorEnabled()) {
    if (!isProxyReady()) throw new PrivacyRouteError('Private X proxy is finding a working exit. Direct fallback is blocked.')
    if (hasUnsupportedPrivateBody) throw new PrivacyRouteError('This private X route cannot tunnel a binary upload. Direct fallback is blocked.')
    const proxy = activeProxy()!
    try {
      const result = await proxyRequest({ url: raw, method, headers, body, proxyHost: proxy.host, proxyPort: proxy.port, timeoutMs })
      reportProxyResult(proxy, true)
      return responseFrom(result.body, result.status)
    } catch {
      reportProxyResult(proxy, false)
      throw new PrivacyRouteError('The private X exit failed. Tru did not retry directly.')
    }
  }

  if (isTorEnabled()) {
    if (!isTorReady()) throw new PrivacyRouteError(`Tor is ${torStatus() === 'STARTING' ? 'connecting' : 'not ready'}. Direct fallback is blocked.`)
    if (hasUnsupportedPrivateBody) throw new PrivacyRouteError('This Tor route cannot tunnel a binary upload. Direct fallback is blocked.')
    try {
      const result = await proxyRequest({ url: raw, method, headers, body, proxyHost: TOR_PROXY_HOST, proxyPort: TOR_HTTP_PROXY_PORT, timeoutMs: Math.max(timeoutMs, 30_000) })
      return responseFrom(result.body, result.status)
    } catch { throw new PrivacyRouteError('Tor request failed. Tru did not retry directly.') }
  }

  const relayEligible = ['GET', 'HEAD'].includes(method) && !containsCredentials(headers) && canRelayPublicUrl(raw)
  if (relayEligible) {
    try {
      return await fetch(relayPublicUrl(raw), { ...init, credentials: 'omit', headers })
    }
    catch { throw new PrivacyRouteError('Relay request failed. Tru did not retry directly.') }
  }
  return fetch(raw, init)
}

/** Native media cannot use the embedded HTTP tunnel. Relay it or fail closed. */
export function privacyMediaUrl(raw: string): string | null {
  if (!/^https?:\/\//i.test(raw)) return raw
  if (isTorEnabled()) return null
  if (canRelayPublicUrl(raw)) return relayPublicUrl(raw)
  if (isProxyPreferenceOn() && isXHost(hostOf(raw))) return null
  return raw
}
