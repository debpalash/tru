import { useSyncExternalStore } from 'react'

import { subscribePrivacy } from './events'
import { loadProxyPreference, proxyPoolStatus, type ProxyPoolStatus } from './proxyPool'
import { getRelayUrl, isRelayEnabled, loadRelayPreference } from './relay'
import { isTorEnabled, isTorReady, loadTorPreference, torAvailable, torStatus } from './tor'

export interface PrivacySnapshot {
  torEnabled: boolean
  torStatus: string
  torAvailable: boolean
  relayEnabled: boolean
  relayUrl: string
  proxy: ProxyPoolStatus
}

let lastKey = ''
let lastSnapshot: PrivacySnapshot | null = null

export function privacySnapshot(): PrivacySnapshot {
  const next: PrivacySnapshot = {
    torEnabled: isTorEnabled(),
    torStatus: torStatus(),
    torAvailable: torAvailable(),
    relayEnabled: isRelayEnabled(),
    relayUrl: getRelayUrl(),
    proxy: proxyPoolStatus(),
  }
  const key = JSON.stringify(next)
  if (lastSnapshot && key === lastKey) return lastSnapshot
  lastKey = key
  lastSnapshot = next
  return next
}

export function usePrivacySnapshot(): PrivacySnapshot {
  return useSyncExternalStore(subscribePrivacy, privacySnapshot, privacySnapshot)
}

export async function initializePrivacy(): Promise<void> {
  await Promise.all([loadRelayPreference(), loadTorPreference(), loadProxyPreference()])
}

/** Headless jobs load preferences first and refuse to run while Tor connects. */
export async function initializeBackgroundPrivacy(timeoutMs = 15_000): Promise<void> {
  await initializePrivacy()
  if (!isTorEnabled()) return
  const deadline = Date.now() + timeoutMs
  while (!isTorReady() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!isTorReady()) throw new Error('Tor did not become ready. Background network access stayed blocked.')
}

export * from './proxyPool'
export * from './relay'
export * from './tor'
export * from './transport'
export * from './webview'
