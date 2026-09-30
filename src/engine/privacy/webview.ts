import { setWebViewProxy } from '../../../modules/proxy-http'

import { activeProxy, isProxyReady } from './proxyPool'
import { isTorReady, TOR_HTTP_PROXY_PORT, TOR_PROXY_HOST } from './tor'

export type WebViewProxyOwner = object

let currentOwner: WebViewProxyOwner | null = null

async function claim(owner: WebViewProxyOwner, hostPort: string): Promise<boolean> {
  const ok = await setWebViewProxy(hostPort)
  if (ok) currentOwner = owner
  return ok
}

/** Claims the process-wide Android WebView proxy for embedded Tor. */
export async function claimTorWebViewProxy(owner: WebViewProxyOwner): Promise<boolean> {
  if (!isTorReady()) return false
  return claim(owner, `${TOR_PROXY_HOST}:${TOR_HTTP_PROXY_PORT}`)
}

/** Claims the process-wide Android WebView proxy for the current X exit. */
export async function claimXWebViewProxy(owner: WebViewProxyOwner): Promise<boolean> {
  if (!isProxyReady()) return false
  const proxy = activeProxy()
  if (!proxy) return false
  return claim(owner, `${proxy.host}:${proxy.port}`)
}

/** A stale screen cannot clear a proxy that a newer screen owns. */
export async function releaseWebViewProxy(owner: WebViewProxyOwner): Promise<void> {
  if (currentOwner !== owner) return
  currentOwner = null
  await setWebViewProxy(null)
}
