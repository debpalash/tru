type SecureStoreModule = typeof import('expo-secure-store')
import type { UnifiedFeedItem } from './types'

const STORAGE_KEY = 'tru.saved.feed-items'
const RECORDS_KEY = 'tru.saved.records.v1'
let ids = new Set<string>()
let records: SavedFeedRecord[] = []
let loaded = false

export interface SavedFeedRecord {
  id: string
  kind: UnifiedFeedItem['kind']
  sourceName: string
  sourceShort: string
  title: string
  summary?: string
  meta?: string
  url?: string
  time?: number
  savedAt: number
  evidenceLabel: string
  evidenceScore: number
  citations: { publisher: string; url: string }[]
  offlineText?: string
}

function secureStore(): SecureStoreModule | null {
  try {
    return require('expo-secure-store') as SecureStoreModule
  } catch {
    return null
  }
}

export async function loadSavedFeedIds(): Promise<Set<string>> {
  if (!loaded) {
    loaded = true
    try {
      const raw = await secureStore()?.getItemAsync(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) ids = new Set(parsed.filter((value): value is string => typeof value === 'string'))
      }
      const recordRaw = await secureStore()?.getItemAsync(RECORDS_KEY)
      if (recordRaw) {
        const parsed = JSON.parse(recordRaw) as unknown
        if (Array.isArray(parsed)) records = parsed.filter((value): value is SavedFeedRecord => Boolean(value && typeof value === 'object' && typeof (value as SavedFeedRecord).id === 'string'))
      }
    } catch {
      ids = new Set()
    }
  }
  return new Set(ids)
}

export async function loadSavedFeedItems(): Promise<SavedFeedRecord[]> {
  await loadSavedFeedIds()
  return [...records].sort((a, b) => b.savedAt - a.savedAt)
}

function toRecord(item: UnifiedFeedItem): SavedFeedRecord {
  return {
    id: item.id,
    kind: item.kind,
    sourceName: item.sourceName,
    sourceShort: item.sourceShort,
    title: item.title,
    summary: item.summary,
    meta: item.meta,
    url: item.url,
    time: item.time,
    savedAt: Date.now(),
    evidenceLabel: item.evidence.label,
    evidenceScore: item.evidence.score,
    citations: item.evidence.links.slice(0, 8).map((link) => ({ publisher: link.publisher, url: link.url })),
  }
}

export async function toggleSavedFeedItem(item: UnifiedFeedItem): Promise<Set<string>> {
  await loadSavedFeedIds()
  if (ids.has(item.id)) {
    ids.delete(item.id)
    records = records.filter((record) => record.id !== item.id)
  } else {
    ids.add(item.id)
    records = [toRecord(item), ...records.filter((record) => record.id !== item.id)].slice(0, 250)
  }
  try {
    await Promise.all([
      secureStore()?.setItemAsync(STORAGE_KEY, JSON.stringify([...ids])),
      secureStore()?.setItemAsync(RECORDS_KEY, JSON.stringify(records)),
    ])
  } catch {
    // Memory remains authoritative for the current session.
  }
  return new Set(ids)
}

export async function updateSavedOfflineText(id: string, text: string): Promise<SavedFeedRecord | null> {
  await loadSavedFeedIds()
  const index = records.findIndex((record) => record.id === id)
  if (index < 0) return null
  records[index] = { ...records[index], offlineText: text.trim().slice(0, 12_000) }
  try { await secureStore()?.setItemAsync(RECORDS_KEY, JSON.stringify(records)) } catch { /* memory remains updated */ }
  return records[index]
}

export async function toggleSavedFeedId(id: string): Promise<Set<string>> {
  await loadSavedFeedIds()
  if (ids.has(id)) ids.delete(id)
  else ids.add(id)
  if (!ids.has(id)) records = records.filter((record) => record.id !== id)
  try {
    await secureStore()?.setItemAsync(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // The current session still reflects the action.
  }
  return new Set(ids)
}
