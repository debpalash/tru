import type { UnifiedFeedItem } from '../feed/types'

type SecureStoreModule = typeof import('expo-secure-store')
export interface Monitor { id: string; query: string; enabled: boolean; createdAt: number }
const KEY = 'tru.monitors.v1'; let cache: Monitor[] | null = null
function store(): SecureStoreModule { return require('expo-secure-store') as SecureStoreModule }
export async function loadMonitors(): Promise<Monitor[]> { if (cache) return [...cache]; try { const raw = await store().getItemAsync(KEY); const value: unknown = raw ? JSON.parse(raw) : []; cache = Array.isArray(value) ? value.filter((item): item is Monitor => Boolean(item && typeof item === 'object' && typeof (item as Monitor).query === 'string')) : [] } catch { cache = [] } return [...cache] }
async function persist(items: Monitor[]): Promise<Monitor[]> { const next = items.slice(0, 30); await store().setItemAsync(KEY, JSON.stringify(next)); cache = next; return [...next] }
export async function addMonitor(query: string): Promise<Monitor[]> { const clean = query.replace(/\s+/g, ' ').trim().slice(0, 80); if (!clean) return loadMonitors(); const items = await loadMonitors(); return persist([{ id: `${Date.now()}:${clean.toLowerCase()}`, query: clean, enabled: true, createdAt: Date.now() }, ...items.filter((item) => item.query.toLowerCase() !== clean.toLowerCase())]) }
export async function removeMonitor(id: string): Promise<Monitor[]> { return persist((await loadMonitors()).filter((item) => item.id !== id)) }
export async function toggleMonitor(id: string): Promise<Monitor[]> { return persist((await loadMonitors()).map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item)) }
export function monitorMatches(title: string, monitors: Monitor[]): Monitor[] { const lower = title.toLowerCase(); return monitors.filter((monitor) => monitor.enabled && monitor.query.toLowerCase().split(/\s+/).every((token) => lower.includes(token))) }
export function prioritizeMonitored(items: UnifiedFeedItem[], monitors: Monitor[]): UnifiedFeedItem[] { return [...items].sort((a, b) => Number(monitorMatches(b.title, monitors).length > 0) - Number(monitorMatches(a.title, monitors).length > 0)) }
