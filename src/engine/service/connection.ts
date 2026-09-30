import { useSyncExternalStore } from 'react'
import { privacyFetch } from '../privacy/transport'
const KEY = 'tru.service.connection.v1'
type Connection = { url: string; token: string; providers: string[]; media: boolean; web: boolean }
let current: Connection | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }
function store(): typeof import('expo-secure-store') { return require('expo-secure-store') }
export function serviceConnection(): Omit<Connection, 'token'> | null {
  return current ? { url: current.url, providers: current.providers, media: current.media, web: current.web } : null
}
export function serviceHasProvider(id: string): boolean { return current?.providers.includes(id) ?? false }
export function serviceHasMedia(): boolean { return current?.media ?? false }
export function serviceHasWeb(): boolean { return current?.web ?? false }
export function useServiceConnected(): boolean {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => Boolean(current), () => false)
}
function normalize(raw: string): string {
  const url = new URL(raw.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Enter an HTTPS service origin, without a path or credentials.')
  return url.origin
}
export async function loadServiceConnection(): Promise<void> {
  try {
    const saved = JSON.parse(await store().getItemAsync(KEY) || 'null')
    if (saved && /^[\w-]{43}$/.test(saved.token) && Array.isArray(saved.providers)) current = { url: normalize(saved.url), token: saved.token, providers: saved.providers.filter((p: unknown) => typeof p === 'string'), media: saved.media === true, web: saved.web === true }
  } catch { current = null }
  emit()
}
export async function connectService(url: string, token: string): Promise<void> {
  const origin = normalize(url); const clean = token.trim()
  if (!/^[\w-]{43}$/.test(clean)) throw new Error('Enter a valid service access token.')
  const response = await privacyFetch(`${origin}/v1/status`, { headers: { Authorization: `Bearer ${clean}` }, signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (!response.ok) throw new Error('Connection rejected. Check the address and access token.')
  const result = await response.json()
  if (!Array.isArray(result.providers)) throw new Error('This address is not a Tru service.')
  const next = { url: origin, token: clean, providers: result.providers, media: result.media === true, web: result.web === true }
  await store().setItemAsync(KEY, JSON.stringify(next))
  current = next; emit()
}
export async function disconnectService(): Promise<void> {
  await store().deleteItemAsync(KEY)
  current = null; emit()
}
export async function serviceFetch(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const connection = current
  if (!connection) throw new Error('Connect Tru service in Settings to use AI and web research.')
  if (!/^\/v1\/(chat\/(gemini|groq|cerebras|openrouter|nvidia)|media|web\/(search|scrape))$/.test(path)) throw new Error('Unsupported service request.')
  return privacyFetch(`${connection.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` }, body: JSON.stringify(body), redirect: 'error', signal }, 30000)
}
