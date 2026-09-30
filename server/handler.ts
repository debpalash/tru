import type { AccessStore } from './security'
import { trustedPublisherForUrl, trustedSearchDomains } from './publishers'

const PROVIDERS = {
  gemini: ['GOOGLE_AI', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-flash-lite-latest'],
  groq: ['GROQ', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'],
  cerebras: ['CEREBRAS', 'https://api.cerebras.ai/v1', 'qwen-3.8-27b'],
  openrouter: ['OPENROUTER', 'https://openrouter.ai/api/v1', 'nvidia/nemotron-3-super-120b-a12b:free'],
  nvidia: ['NVIDIA', 'https://integrate.api.nvidia.com/v1', 'nvidia/nemotron-3-super-120b-a12b'],
} as const
const SAFETY_PROMPT = 'Classify for a strict general-audience news app. Reply exactly SAFE or UNSAFE. UNSAFE includes nudity, intimate anatomy, sexually suggestive framing, underwear, fetish, erotic content, sexual advertising, graphic violence, or illegal imagery. If uncertain reply UNSAFE.'
type Env = Record<string, string | undefined>
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
export async function readBounded(response: Response | Request, limit: number): Promise<string> {
  if (Number(response.headers.get('content-length')) > limit) throw new Error('body too large')
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error('body too large')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const out = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(out)
}
export function createHandler(store: Pick<AccessStore, 'authenticate' | 'consume'>, env: Env, upstream: typeof fetch = fetch) {
  const disabled = new Set((env.TRU_DISABLED_PROVIDERS || '').split(',').map((id) => id.trim()))
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname
    if (path === '/health' && request.method === 'GET') return json({ ok: true })
    const identity = store.authenticate(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '')
    if (!identity) return json({ error: { message: 'Connect a valid Tru access token in Settings.' } }, 401)
    if (!store.consume(identity, path === '/v1/media' ? 2 : 1)) return json({ error: { message: 'Service allowance reached. Try again later.' } }, 429)
    if (path === '/v1/status' && request.method === 'GET') return json({ providers: Object.entries(PROVIDERS).filter(([id, [prefix]]) => !disabled.has(id) && env[`${prefix}_API_KEY`]).map(([id]) => id), media: !disabled.has('gemini') && Boolean(env.GOOGLE_AI_API_KEY), web: Boolean(env.FIRECRAWL_API_KEY) })
    if (request.method !== 'POST') return json({ error: { message: 'Method not allowed.' } }, 405)
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: { message: 'JSON required.' } }, 415)
    let body: any
    try { body = JSON.parse(await readBounded(request, path === '/v1/media' ? 6000000 : 48000)) } catch { return json({ error: { message: 'Invalid or oversized request.' } }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: { message: 'Invalid request.' } }, 400)
    let url = ''; let headers: Record<string, string> = { 'Content-Type': 'application/json' }; let payload: unknown
    if (path.startsWith('/v1/chat/')) {
      const id = path.slice('/v1/chat/'.length)
      if (!Object.hasOwn(PROVIDERS, id)) return json({ error: { message: 'Unknown provider.' } }, 404)
      const [prefix, base, model] = PROVIDERS[id as keyof typeof PROVIDERS]
      const key = env[`${prefix}_API_KEY`]
      if (!key || disabled.has(id)) return json({ error: { message: 'Provider unavailable.' } }, 503)
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 24 || body.messages.some((m: any) => !m || !['user','assistant','system'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 20000)) return json({ error: { message: 'Invalid messages.' } }, 400)
      url = `${base}/chat/completions`; headers.Authorization = `Bearer ${key}`
      payload = { model: env[`${prefix}_MODEL`] || model, messages: body.messages.map((m: any) => ({ role: m.role, content: m.content })), max_tokens: Math.min(1200, Math.max(1, Number(body.max_tokens) || 900)), temperature: 0.1 }
    } else if (path === '/v1/media') {
      if (!env.GOOGLE_AI_API_KEY || disabled.has('gemini')) return json({ error: { message: 'Media verification unavailable.' } }, 503)
      if (!['image/jpeg','image/png','image/webp'].includes(body.mimeType) || typeof body.data !== 'string' || !body.data.length || body.data.length > 5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.data)) return json({ error: { message: 'Invalid image.' } }, 400)
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GOOGLE_AI_MODEL || 'gemini-flash-lite-latest')}:generateContent`
      headers['x-goog-api-key'] = env.GOOGLE_AI_API_KEY
      payload = { contents: [{ parts: [{ text: SAFETY_PROMPT }, { inlineData: { mimeType: body.mimeType, data: body.data } }] }], generationConfig: { temperature: 0, maxOutputTokens: 16 } }
    } else if (path === '/v1/web/search' || path === '/v1/web/scrape') {
      if (!env.FIRECRAWL_API_KEY) return json({ error: { message: 'Web research unavailable.' } }, 503)
      headers.Authorization = `Bearer ${env.FIRECRAWL_API_KEY}`
      url = `https://api.firecrawl.dev/v2/${path.endsWith('/search') ? 'search' : 'scrape'}`
      if (path.endsWith('/search')) {
        if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 4000) return json({ error: { message: 'Invalid query.' } }, 400)
        payload = { query: `(${body.query.replace(/site:\S+/gi, '')}) (${trustedSearchDomains().map((d) => `site:${d}`).join(' OR ')})`, limit: 10, sources: ['web'], tbs: 'qdr:w', safe: true }
      } else {
        if (typeof body.url !== 'string' || !trustedPublisherForUrl(body.url)) return json({ error: { message: 'Publisher not allowed.' } }, 400)
        payload = { url: body.url, formats: ['markdown'], onlyMainContent: true, timeout: 15000 }
      }
    } else return json({ error: { message: 'Not found.' } }, 404)
    try {
      const response = await upstream(url, { method: 'POST', headers, body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(25000) })
      // Never echo provider errors: they may include credentials or request data.
      if (!response.ok) { await response.body?.cancel(); return json({ error: { message: `Provider request failed (${response.status}).` } }, [401,403,429].includes(response.status) ? 503 : 502) }
      const result = JSON.parse(await readBounded(response, 2000000))
      if (path === '/v1/media') {
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        return json({ verdict: text === 'SAFE' && !result?.promptFeedback?.blockReason ? 'safe' : 'unsafe' })
      }
      return json(result)
    } catch { return json({ error: { message: 'Provider unavailable. Try again later.' } }, 502) }
  }
}
