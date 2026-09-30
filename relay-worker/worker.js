// Public feed/media relay: exact host allowlist, per-IP throttling, bounded bodies.
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_HOSTS = new Set([
  'pbs.twimg.com', 'video.twimg.com', 'abs.twimg.com',
  'feeds.bbci.co.uk', 'www.theverge.com', 'feeds.arstechnica.com',
  'www.thehindu.com', 'feeds.feedburner.com', 'indianexpress.com',
  'www.theguardian.com', 'feeds.npr.org', 'news.ycombinator.com',
  'hacker-news.firebaseio.com', 'hacker-news.firebaseio.com', 'github.com',
  'www.producthunt.com', 'www.cloudflare.com',
])
async function boundedBody(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('too large') }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  let size = 0; const chunks = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) throw new Error('too large')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const out = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}
// Tru public-content relay. Deliberately incapable of forwarding account
// credentials or request bodies.

const RESPONSE_DROP = [
  'set-cookie', 'set-cookie2', 'www-authenticate',
  'content-security-policy-report-only', 'report-to', 'nel',
]

function cors(headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Accept, Accept-Language, If-Modified-Since, If-None-Match, Range')
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified')
  headers.set('X-Tru-Relay', '1')
  return headers
}

function deniedHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local') || host.endsWith('.internal')) return true
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return host.includes(':')
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
}

function safeTarget(raw, relayOrigin) {
  try {
    const target = new URL(raw)
    if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443') || !ALLOWED_HOSTS.has(target.hostname)) return null
    if (target.origin === relayOrigin || deniedHost(target.hostname)) return null
    return target
  } catch {
    return null
  }
}

function upstreamHeaders(request) {
  const headers = new Headers()
  for (const name of ['accept', 'accept-language', 'if-modified-since', 'if-none-match', 'range']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // A stable UA avoids forwarding a device/browser fingerprint.
  headers.set('User-Agent', 'Tru-Relay/1.0 (+https://workers.cloudflare.com)')
  return headers
}

function relayUrl(requestUrl, target) {
  const relayed = new URL(requestUrl.origin + requestUrl.pathname)
  relayed.searchParams.set('url', target.toString())
  return relayed.toString()
}

async function fetchValidated(target, init, relayOrigin) {
  let current = target
  for (let count = 0; count < 6; count += 1) {
    const response = await fetch(current.toString(), { ...init, redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, origin: current }
    const location = response.headers.get('location')
    await response.body?.cancel()
    const next = location ? safeTarget(new URL(location, current).toString(), relayOrigin) : null
    if (!next) throw new Error('unsafe redirect')
    current = next
  }
  throw new Error('too many redirects')
}

function rewritePlaylist(text, origin, requestUrl) {
  const wrap = (raw) => {
    try { return relayUrl(requestUrl, new URL(raw, origin)) } catch { return raw }
  }
  return text.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return line
    if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${wrap(uri)}"`)
    return wrap(trimmed)
  }).join('\n')
}

export default {
  async fetch(request, env = {}) {
    const requestUrl = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() })
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Tru relay: method not allowed', { status: 405, headers: cors(new Headers({ Allow: 'GET, HEAD, OPTIONS' })) })

    // Missing rate-limit binding is a deployment error, never an unlimited relay.
    if (!env.RATE_LIMITER) return new Response('Relay not configured', { status: 503 })
    try {
      const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })
      if (!success) return new Response('Relay allowance reached', { status: 429, headers: { 'Retry-After': '60' } })
    } catch { return new Response('Relay unavailable', { status: 503 }) }
    const target = safeTarget(requestUrl.searchParams.get('url') || '', requestUrl.origin)
    if (!target) return new Response('Tru relay: pass a public HTTPS URL in ?url=', { status: 400, headers: cors() })

    try {
      const { response, origin } = await fetchValidated(target, { method: request.method, headers: upstreamHeaders(request) }, requestUrl.origin)
      const headers = new Headers(response.headers)
      for (const name of RESPONSE_DROP) headers.delete(name)
      cors(headers)
      headers.delete('content-encoding')
      headers.delete('content-length')
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
      headers.set('X-Content-Type-Options', 'nosniff')

      const bytes = request.method === 'HEAD' ? null : await boundedBody(response)
      const contentType = (headers.get('content-type') || '').toLowerCase()
      const playlist = contentType.includes('mpegurl') || /\.m3u8(?:$|\?)/i.test(origin.pathname + origin.search)
      if (playlist && request.method === 'GET') {
        const body = rewritePlaylist(new TextDecoder().decode(bytes), origin, requestUrl)
        headers.delete('content-length')
        return new Response(body, { status: response.status, statusText: response.statusText, headers })
      }
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, statusText: response.statusText, headers })
    } catch {
      return new Response('Tru relay: upstream unavailable', { status: 502, headers: cors() })
    }
  },
}
