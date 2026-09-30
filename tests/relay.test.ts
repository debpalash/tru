import { test, expect } from 'bun:test'
import worker from '../relay-worker/worker.js'
const env = { RATE_LIMITER: { limit: async () => ({ success: true }) } }
const request = (url: string) => new Request('https://relay.example/?url=' + encodeURIComponent(url))
test('relay requires its limiter and rejects arbitrary/private/credential URLs', async () => {
  expect((await worker.fetch(request('https://pbs.twimg.com/a'))).status).toBe(503)
  for (const target of ['https://evil.example', 'https://127.0.0.1', 'https://pbs.twimg.com.evil.example/a','https://user:pass@pbs.twimg.com/a','https://pbs.twimg.com:8443/a']) expect((await worker.fetch(request(target), env)).status).toBe(400)
  expect((await worker.fetch(request('https://pbs.twimg.com/a'), { RATE_LIMITER: { limit: async () => ({ success: false }) } })).status).toBe(429)
})
test('relay rejects redirect escapes, oversized responses, and strips cookies', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = (async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } })) as unknown as typeof fetch
    expect((await worker.fetch(request('https://pbs.twimg.com/a'), env)).status).toBe(502)
    globalThis.fetch = (async () => new Response('large', { headers: { 'content-length': '9000000' } })) as unknown as typeof fetch
    expect((await worker.fetch(request('https://pbs.twimg.com/a'), env)).status).toBe(502)
    globalThis.fetch = (async (_url, init) => {
      expect(new Headers(init?.headers).get('cookie')).toBeNull()
      return new Response('image', { headers: { 'set-cookie': 'secret=fixture', 'content-type': 'image/png' } })
    }) as typeof fetch
    const response = await worker.fetch(request('https://pbs.twimg.com/a'), env)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.text()).toBe('image')
  } finally { globalThis.fetch = original }
})
