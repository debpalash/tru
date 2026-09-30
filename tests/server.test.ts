import { test, expect } from 'bun:test'
import { createHandler } from '../server/handler'
import { AccessStore } from '../server/security'
function request(path: string, token: string, body: unknown) { return new Request(`https://service.example${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
test('service denies unauthenticated, revoked and expired tokens', async () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test')
  const handler = createHandler(store, {})
  expect((await handler(request('/v1/chat/gemini', 'wrong', {}))).status).toBe(401)
  store.revoke('test')
  expect((await handler(request('/v1/chat/gemini', token, {}))).status).toBe(401)
  const expired = store.issue('expired', -1)
  expect(store.authenticate(expired)).toBeNull(); store.db.close()
})
test('provider keys stay upstream; URL, model and max tokens are server controlled', async () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test'); let seen = false
  const handler = createHandler(store, { GOOGLE_AI_API_KEY: 'server-only-fixture' }, (async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-only-fixture')
    const body = JSON.parse(String(init?.body)); expect(body.max_tokens).toBe(1200); expect(body.model).not.toBe('attacker-model'); seen = true
    return Response.json({ choices: [{ message: { content: 'ok' } }] })
  }) as unknown as typeof fetch)
  const response = await handler(request('/v1/chat/gemini', token, { messages: [{ role: 'user', content: 'hello' }], model: 'attacker-model', max_tokens: 900000, baseUrl: 'https://evil.example' }))
  expect(response.status).toBe(200); expect(seen).toBe(true); expect(await response.text()).not.toContain('server-only-fixture'); store.db.close()
})
test('upstream errors never reveal credentials', async () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test')
  const handler = createHandler(store, { GOOGLE_AI_API_KEY: 'secret-fixture' }, (async () => new Response('secret-fixture', { status: 403 })) as unknown as typeof fetch)
  const response = await handler(request('/v1/chat/gemini', token, { messages: [{ role: 'user', content: 'hello' }] }))
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret-fixture'); store.db.close()
})
test('quotas cannot be reset by reusing a token', () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test'); const id = store.authenticate(token)!
  for (let i = 0; i < 30; i++) expect(store.consume(id)).toBe(true)
  expect(store.consume(store.authenticate(token)!)).toBe(false); store.db.close()
})
test('media requires an exact safe verdict and web refuses arbitrary URLs', async () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test')
  const handler = createHandler(store, { GOOGLE_AI_API_KEY: 'fixture', FIRECRAWL_API_KEY: 'fixture' }, (async () => Response.json({ candidates: [{ content: { parts: [{ text: 'Probably SAFE' }] } }] })) as unknown as typeof fetch)
  expect(await (await handler(request('/v1/media', token, { mimeType: 'image/png', data: 'aGVsbG8=' }))).json()).toEqual({ verdict: 'unsafe' })
  expect((await handler(request('/v1/web/scrape', token, { url: 'https://127.0.0.1/private' }))).status).toBe(400)
  expect((await handler(request('/v1/chat/__proto__', token, {}))).status).toBe(404); store.db.close()
})


test('chunked oversized requests are rejected before contacting providers', async () => {
  const store = new AccessStore(':memory:'); const token = store.issue('test')
  const handler = createHandler(store, { GOOGLE_AI_API_KEY: 'fixture' }, (async () => { throw new Error('must not call upstream') }) as unknown as typeof fetch)
  const response = await handler(request('/v1/chat/gemini', token, { messages: [{ role: 'user', content: 'x'.repeat(50000) }] }))
  expect(response.status).toBe(400); store.db.close()
})


test('disabled providers disappear from status and cannot receive requests', async () => {
  const store = new AccessStore(':memory:')
  const token = store.issue('test')
  const handler = createHandler(store, { GOOGLE_AI_API_KEY: 'fixture', NVIDIA_API_KEY: 'fixture', TRU_DISABLED_PROVIDERS: 'gemini' }, (async () => { throw new Error('must not call upstream') }) as unknown as typeof fetch)
  const status = await (await handler(new Request('https://service.example/v1/status', { headers: { Authorization: `Bearer ${token}` } }))).json()
  expect(status).toEqual({ providers: ['nvidia'], media: false, web: false })
  expect((await handler(request('/v1/chat/gemini', token, { messages: [{ role: 'user', content: 'hello' }] }))).status).toBe(503)
  expect((await handler(request('/v1/media', token, { mimeType: 'image/png', data: 'aGVsbG8=' }))).status).toBe(503)
  store.db.close()
})
