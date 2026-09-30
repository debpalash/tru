import { test, expect, mock } from 'bun:test'
let tor = false; let relay = true
mock.module('../src/engine/privacy/tor', () => ({ isTorEnabled: () => tor, isTorReady: () => false, TOR_HTTP_PROXY_PORT: 8118, TOR_PROXY_HOST: '127.0.0.1', torStatus: () => 'STARTING' }))
// Use actual relay preference APIs; do not replace the transport under test.
import { setRelayEnabled, setRelayUrl } from '../src/engine/privacy/relay'
import { privacyMediaUrl, privacyFetch } from '../src/engine/privacy/transport'
test('Tor blocks native media even when Relay is also enabled and API requests never fall back', async () => {
  await setRelayUrl('https://relay.example'); await setRelayEnabled(true)
  tor = true
  expect(privacyMediaUrl('https://pbs.twimg.com/image.jpg')).toBeNull()
  await expect(privacyFetch('https://example.com')).rejects.toThrow('Direct fallback is blocked')
  tor = false
  expect(privacyMediaUrl('https://pbs.twimg.com/image.jpg')).toContain('https://relay.example')
  await setRelayEnabled(false)
})
