export interface ProxyHttpResponse {
  status: number
  body: string
}

export interface TorInfo {
  read: number
  written: number
  circuits: number
  path: string
}

interface ProxyHttpNative {
  request(url: string, method: string, headers: Record<string, string>, body: string | null, proxyHost: string | null, proxyPort: number, timeoutMs: number): Promise<ProxyHttpResponse>
  isOrbotInstalled(): boolean
  openOrbot(): Promise<boolean>
  startEmbeddedTor(): Promise<boolean>
  stopEmbeddedTor(): Promise<boolean>
  getTorStatus(): string
  getTorInfo(): Promise<TorInfo | null>
  setWebViewProxy(hostPort: string | null): Promise<boolean>
}

let native: ProxyHttpNative | null = null

function getNative(): ProxyHttpNative | null {
  if (native) return native
  try {
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core')
    native = requireNativeModule('ProxyHttp') as ProxyHttpNative
  } catch { native = null }
  return native
}

export function isProxyHttpAvailable(): boolean { return getNative() !== null }
export function isOrbotInstalled(): boolean {
  try { return getNative()?.isOrbotInstalled() ?? false } catch { return false }
}
export async function openOrbot(): Promise<boolean> {
  const mod = getNative()
  if (!mod) throw new Error('Private networking is unavailable in this build.')
  return mod.openOrbot()
}
export async function startEmbeddedTor(): Promise<boolean> {
  try { return await getNative()?.startEmbeddedTor() ?? false } catch { return false }
}
export async function stopEmbeddedTor(): Promise<boolean> {
  try { return await getNative()?.stopEmbeddedTor() ?? false } catch { return false }
}
export function getTorStatus(): string {
  try { return getNative()?.getTorStatus() ?? 'OFF' } catch { return 'OFF' }
}
export async function getTorInfo(): Promise<TorInfo | null> {
  try { return await getNative()?.getTorInfo() ?? null } catch { return null }
}
export async function setWebViewProxy(hostPort: string | null): Promise<boolean> {
  try { return await getNative()?.setWebViewProxy(hostPort) ?? false } catch { return false }
}

export function proxyRequest(args: {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string | null
  proxyHost?: string | null
  proxyPort?: number
  timeoutMs?: number
}): Promise<ProxyHttpResponse> {
  const mod = getNative()
  if (!mod) throw new Error('Private networking is unavailable in this build.')
  return mod.request(args.url, args.method ?? 'GET', args.headers ?? {}, args.body ?? null, args.proxyHost ?? null, args.proxyPort ?? 0, args.timeoutMs ?? 15_000)
}
