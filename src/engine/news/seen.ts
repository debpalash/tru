// Unseen-badge store for the News tab. Mirrors the keyword-monitor "seen"
// pattern in app/index.tsx (KW_SEEN_KEY): a persisted set of already-seen item
// ids, a `latest` id list refreshed by a gentle background poll, and
// `unseen = latest − seen`. Opening the News tab marks everything seen (§4.4).
//
// This is a self-contained observable module so app/index.tsx stays minimal: it
// only calls the `useNewsUnseen()` hook (which lazily starts the poll) and
// `markNewsSeen()` when the tab is opened. No new deps, only SecureStore.

import { useEffect, useState } from 'react'
import { fetchNews } from './feed'

const SEEN_KEY = 'tru.news_seen' // string[] of seen NewsItem ids
const MAX_SEEN = 500 // bound the persisted set so it can't grow unbounded
// Gentle cadence: this runs even when the News tab isn't open so the badge is
// live, so keep it slow (battery/data). Matches the source intervalMs.
const POLL_MS = 600_000
const FIRST_POLL_DELAY_MS = 4_000

let seen = new Set<string>()
let latest: string[] = []
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function SecureStore(): typeof import('expo-secure-store') {
  return require('expo-secure-store') as typeof import('expo-secure-store')
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  if (loading) return loading
  loading = (async () => {
    try {
      const raw = await SecureStore().getItemAsync(SEEN_KEY)
      if (raw) seen = new Set(JSON.parse(raw) as string[])
    } catch {
      /* ignore and start with an empty set */
    }
    loaded = true
    emit()
  })()
  return loading
}

function persist(): void {
  try {
    // Keep only the most recent ids (Set preserves insertion order).
    const ids = Array.from(seen).slice(-MAX_SEEN)
    seen = new Set(ids)
    void SecureStore().setItemAsync(SEEN_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

/** Count of currently-known items the user hasn't seen yet. */
export function getNewsUnseen(): number {
  let n = 0
  for (const id of latest) if (!seen.has(id)) n++
  return n
}

/** Record the latest fetched ids (from the poll or the NewsFeed component). */
export function setNewsLatest(ids: string[]): void {
  latest = ids
  emit()
}

/** Mark every currently-known item as seen and clear the badge. */
export function markNewsSeen(): void {
  for (const id of latest) seen.add(id)
  persist()
  emit()
}

export function subscribeNews(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// ---- lazy background poll (ref-counted by the hook) -------------------------

let pollTimer: ReturnType<typeof setTimeout> | null = null
let refCount = 0
// `polling` is the idempotency guard for startPolling (distinct from pollTimer,
// which is transiently null while a tick's pollOnce() is in flight). `generation`
// is bumped each time a fresh chain starts so a tick from a stopped-then-restarted
// chain can tell it's stale and must not reschedule, even if refCount is back
// above 0 by the time it resumes.
let polling = false
let pollGeneration = 0

async function pollOnce(): Promise<void> {
  try {
    const items = await fetchNews('all', null)
    setNewsLatest(items.map((i) => i.id))
  } catch {
    /* non-fatal; retry next tick */
  }
}

function startPolling(): void {
  refCount++
  if (polling) return // already have a live chain; don't start a second one
  polling = true
  const generation = ++pollGeneration
  const tick = async () => {
    await pollOnce()
    // If every subscriber left, or a newer chain has since started, while this
    // tick was awaiting pollOnce, so do not reschedule. Let this chain die.
    if (refCount <= 0 || generation !== pollGeneration) return
    pollTimer = setTimeout(tick, POLL_MS)
  }
  pollTimer = setTimeout(tick, FIRST_POLL_DELAY_MS)
}

function stopPolling(): void {
  refCount = Math.max(0, refCount - 1)
  if (refCount === 0 && polling) {
    polling = false
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }
}

/**
 * Subscribe to the live unseen count. Lazily starts the background badge poll
 * on first mount (ref-counted) and hydrates the persisted seen set. Used by the
 * News tab button in app/index.tsx.
 */
export function useNewsUnseen(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    void ensureLoaded()
    const update = () => setCount(getNewsUnseen())
    const off = subscribeNews(update)
    startPolling()
    update()
    return () => {
      off()
      stopPolling()
    }
  }, [])
  return count
}
