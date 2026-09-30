import { getTorInfo, getTorStatus, isOrbotInstalled, isProxyHttpAvailable, openOrbot, proxyRequest, startEmbeddedTor, stopEmbeddedTor, type TorInfo } from '../../../modules/proxy-http'

import { emitPrivacyChange } from './events'

const ENABLED_KEY = 'tru.privacy.tor.enabled'
export const TOR_PROXY_HOST = '127.0.0.1'
export const TOR_HTTP_PROXY_PORT = 8118

let enabled = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let observedStatus = 'OFF'

function secureStore(): typeof import('expo-secure-store') | null {
  try { return require('expo-secure-store') as typeof import('expo-secure-store') } catch { return null }
}

function syncStatus(): void {
  const next = getTorStatus()
  if (next !== observedStatus) { observedStatus = next; emitPrivacyChange() }
}

function updatePolling(): void {
  if (enabled && !pollTimer) pollTimer = setInterval(syncStatus, 1_500)
  if (!enabled && pollTimer) { clearInterval(pollTimer); pollTimer = null }
  syncStatus()
}

export async function loadTorPreference(): Promise<void> {
  try { enabled = await secureStore()?.getItemAsync(ENABLED_KEY) === '1' } catch { enabled = false }
  updatePolling()
  if (enabled) void startEmbeddedTor().finally(() => { syncStatus(); emitPrivacyChange() })
  emitPrivacyChange()
}

export function isTorEnabled(): boolean { return enabled }
export function isTorReady(): boolean { return enabled && getTorStatus() === 'ON' }
export function torStatus(): string { return getTorStatus() }
export function torAvailable(): boolean { return isProxyHttpAvailable() }
export async function torInfo(): Promise<TorInfo | null> { return getTorInfo() }

export async function setTorEnabled(next: boolean): Promise<void> {
  enabled = next
  emitPrivacyChange()
  try { await secureStore()?.setItemAsync(ENABLED_KEY, next ? '1' : '0') } catch { /* in-memory state still applies */ }
  if (next) await startEmbeddedTor()
  else await stopEmbeddedTor()
  updatePolling()
  emitPrivacyChange()
}

export async function measureTorLatency(): Promise<number> {
  if (!isTorReady()) return -1
  const started = Date.now()
  try {
    await proxyRequest({
      url: 'https://www.cloudflare.com/cdn-cgi/trace',
      proxyHost: TOR_PROXY_HOST,
      proxyPort: TOR_HTTP_PROXY_PORT,
      timeoutMs: 20_000,
    })
    return Date.now() - started
  } catch { return -1 }
}

export { isOrbotInstalled, openOrbot }
