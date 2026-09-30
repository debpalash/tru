import { isProxyHttpAvailable, proxyRequest } from '../../../modules/proxy-http'

import { emitPrivacyChange } from './events'
import { isTorEnabled, isTorReady, TOR_HTTP_PROXY_PORT, TOR_PROXY_HOST } from './tor'
import { canRelayPublicUrl, relayPublicUrl } from './relay'

export interface ProxyEntry { host: string; port: number; failures: number }
export interface ProxyPoolStatus {
  available: boolean
  enabled: boolean
  ready: boolean
  refreshing: boolean
  total: number
  active: ProxyEntry | null
  checked: number
  error: string | null
}

const ENABLED_KEY = 'tru.privacy.proxy.enabled'
const SOURCES = [
  'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=elite',
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
]
const X_PROBE = 'https://x.com/robots.txt'

let enabled = false
let refreshing = false
let checked = 0
let error: string | null = null
let pool: ProxyEntry[] = []
let activeIndex = 0

function secureStore(): typeof import('expo-secure-store') | null {
  try { return require('expo-secure-store') as typeof import('expo-secure-store') } catch { return null }
}

export async function loadProxyPreference(): Promise<void> {
  try { enabled = await secureStore()?.getItemAsync(ENABLED_KEY) === '1' } catch { enabled = false }
  emitPrivacyChange()
  if (enabled) void refreshProxyPool()
}

export function isProxyPreferenceOn(): boolean { return enabled }
export function isProxyReady(): boolean { return enabled && pool.length > 0 && isProxyHttpAvailable() }
export function activeProxy(): ProxyEntry | null { return pool[activeIndex] ?? null }
export function proxyPoolStatus(): ProxyPoolStatus {
  return { available: isProxyHttpAvailable(), enabled, ready: isProxyReady(), refreshing, total: pool.length, active: activeProxy(), checked, error }
}

export async function setProxyEnabled(next: boolean): Promise<void> {
  enabled = next
  try { await secureStore()?.setItemAsync(ENABLED_KEY, next ? '1' : '0') } catch { /* in-memory state still applies */ }
  emitPrivacyChange()
  if (next && !pool.length) void refreshProxyPool()
}

export function rotateProxy(): void {
  if (pool.length > 1) activeIndex = (activeIndex + 1) % pool.length
  emitPrivacyChange()
}

export function reportProxyResult(proxy: ProxyEntry, ok: boolean): void {
  const match = pool.find((item) => item.host === proxy.host && item.port === proxy.port)
  if (!match) return
  if (ok) match.failures = 0
  else {
    match.failures += 1
    if (match.failures >= 2) pool = pool.filter((item) => item !== match)
    rotateProxy()
  }
  emitPrivacyChange()
  if (enabled && pool.length < 2 && !refreshing) void refreshProxyPool()
}

async function candidates(): Promise<string[]> {
  const bodies = await Promise.all(SOURCES.map(async (source) => {
    if (isTorEnabled()) {
      if (!isTorReady()) throw new Error('Tor is connecting. Proxy discovery did not fall back to a direct connection.')
      try {
        const response = await proxyRequest({
          url: source,
          proxyHost: TOR_PROXY_HOST,
          proxyPort: TOR_HTTP_PROXY_PORT,
          timeoutMs: 15_000,
        })
        return response.status >= 200 && response.status < 300 ? response.body : ''
      } catch { return '' }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 9_000)
    try {
      const routed = canRelayPublicUrl(source) ? relayPublicUrl(source) : source
      return await (await fetch(routed, { signal: controller.signal, credentials: 'omit' })).text()
    } catch { return '' } finally { clearTimeout(timer) }
  }))
  const found = new Set<string>()
  for (const body of bodies) {
    for (const raw of body.split('\n')) {
      const value = raw.trim()
      if (/^\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(value)) found.add(value)
    }
  }
  return [...found].slice(0, 64)
}

async function probe(value: string): Promise<ProxyEntry | null> {
  const [host, portText] = value.split(':')
  const port = Number(portText)
  if (!host || !Number.isInteger(port)) return null
  try {
    const response = await proxyRequest({ url: X_PROBE, proxyHost: host, proxyPort: port, timeoutMs: 6_000 })
    return response.status === 200 && /User-agent:/i.test(response.body) ? { host, port, failures: 0 } : null
  } catch { return null }
}

export async function refreshProxyPool(): Promise<void> {
  if (refreshing || !enabled || !isProxyHttpAvailable()) return
  refreshing = true
  error = null
  checked = 0
  emitPrivacyChange()
  try {
    const values = await candidates()
    const good: ProxyEntry[] = []
    for (let offset = 0; offset < values.length && good.length < 6; offset += 16) {
      const batch = values.slice(offset, offset + 16)
      const results = await Promise.all(batch.map(probe))
      checked += batch.length
      for (const result of results) if (result && good.length < 6) good.push(result)
      emitPrivacyChange()
    }
    if (good.length) { pool = good; activeIndex = 0 }
    else error = values.length ? 'No working X proxies found.' : 'Proxy lists could not be reached.'
  } catch (reason) { error = (reason as Error)?.message ?? 'Proxy discovery failed.' }
  finally { refreshing = false; emitPrivacyChange() }
}
