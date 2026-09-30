import { emitPrivacyChange } from './events'
import { proxyRequest } from '../../../modules/proxy-http'
import { isTorEnabled, isTorReady, TOR_HTTP_PROXY_PORT, TOR_PROXY_HOST } from './tor'

const ENABLED_KEY = 'tru.privacy.relay.enabled'
const URL_KEY = 'tru.privacy.relay.url'
const ENV_RELAY_URL = (process.env.EXPO_PUBLIC_NEWPAL_RELAY_URL ?? '').trim().replace(/\/+$/, '')

let enabled = false
let baseUrl = ENV_RELAY_URL

function secureStore(): typeof import('expo-secure-store') | null {
  try { return require('expo-secure-store') as typeof import('expo-secure-store') } catch { return null }
}

function normalizedRelayUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, '')
  if (!value) return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString().replace(/\/+$/, '') : ''
  } catch { return '' }
}

export async function loadRelayPreference(): Promise<void> {
  try {
    const [storedEnabled, storedUrl] = await Promise.all([
      secureStore()?.getItemAsync(ENABLED_KEY),
      secureStore()?.getItemAsync(URL_KEY),
    ])
    baseUrl = normalizedRelayUrl(storedUrl ?? ENV_RELAY_URL)
    enabled = storedEnabled === '1' && Boolean(baseUrl)
  } catch {
    baseUrl = normalizedRelayUrl(ENV_RELAY_URL)
    enabled = false
  }
  emitPrivacyChange()
}

export function isRelayEnabled(): boolean { return enabled && Boolean(baseUrl) }
export function getRelayUrl(): string { return baseUrl }

export async function setRelayEnabled(next: boolean): Promise<void> {
  enabled = next && Boolean(baseUrl)
  try { await secureStore()?.setItemAsync(ENABLED_KEY, enabled ? '1' : '0') } catch { /* in-memory state still applies */ }
  emitPrivacyChange()
}

export async function setRelayUrl(raw: string): Promise<boolean> {
  const next = normalizedRelayUrl(raw)
  baseUrl = next
  if (!next) enabled = false
  try {
    await Promise.all([
      secureStore()?.setItemAsync(URL_KEY, next) ?? Promise.resolve(),
      !next ? secureStore()?.setItemAsync(ENABLED_KEY, '0') ?? Promise.resolve() : Promise.resolve(),
    ])
  } catch { /* in-memory state still applies */ }
  emitPrivacyChange()
  return Boolean(next)
}

function urlHost(raw: string): string {
  try { return new URL(raw).hostname.toLowerCase() } catch { return '' }
}

function isLocalHost(host: string): boolean {
  const value = host.replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value === '::1' || value === '0.0.0.0' || value.endsWith('.local') || value.endsWith('.internal')) return true
  const octets = value.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return value.includes(':')
  const [a, b] = octets
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
}

export function canRelayPublicUrl(raw: string): boolean {
  if (!isRelayEnabled()) return false
  try {
    const target = new URL(raw)
    const relay = new URL(baseUrl)
    return target.protocol === 'https:' && !target.username && !target.password
      && !isLocalHost(target.hostname.toLowerCase()) && target.origin !== relay.origin
  } catch { return false }
}

export function relayPublicUrl(raw: string): string {
  return canRelayPublicUrl(raw) ? `${baseUrl}/?url=${encodeURIComponent(raw)}` : raw
}

export async function testRelay(raw = baseUrl): Promise<{ ok: boolean; ms: number; detail: string }> {
  const relay = normalizedRelayUrl(raw)
  if (!relay) return { ok: false, ms: 0, detail: 'Enter an HTTPS Worker URL.' }
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const target = 'https://www.cloudflare.com/cdn-cgi/trace'
    const requestUrl = `${relay}/?url=${encodeURIComponent(target)}`
    let ok = false
    let status = 0
    let body = ''
    if (isTorEnabled()) {
      if (!isTorReady()) return { ok: false, ms: Date.now() - started, detail: 'Tor is connecting. Relay test did not fall back to direct.' }
      const response = await proxyRequest({ url: requestUrl, proxyHost: TOR_PROXY_HOST, proxyPort: TOR_HTTP_PROXY_PORT, timeoutMs: 15_000 })
      status = response.status
      ok = status >= 200 && status < 300
      body = response.body
    } else {
      const response = await fetch(requestUrl, { signal: controller.signal })
      status = response.status
      ok = response.ok
      body = await response.text()
    }
    const location = body.match(/(?:^|\n)loc=([^\n]+)/)?.[1]?.trim()
    return { ok, ms: Date.now() - started, detail: ok ? `Connected${location ? ` · exit ${location}` : ''}` : `HTTP ${status}` }
  } catch (error) {
    return { ok: false, ms: Date.now() - started, detail: controller.signal.aborted ? 'Timed out after 15s.' : (error as Error)?.message ?? 'Relay unavailable.' }
  } finally { clearTimeout(timer) }
}
