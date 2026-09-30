// News aggregation: fetch the enabled sources for a category, merge them into
// one river with cross-source URL dedup, and cache each source's list under a
// per-source TTL (stale-while-revalidate, mirroring NewsNow's cadence). A dead
// source degrades to its stale cache or [] and never crashes the tab.

import { settle } from './http'
import { sourcesFor } from './registry'
import { keepGeneralAudienceNews } from './safety'
import type { NewsCategory, NewsItem, NewsSource } from './types'

// In-memory per-source cache. Persisted disk cache is a CI-layer concern we
// deliberately don't touch (src/engine/cache/* is off-limits); this keeps News
// self-sufficient exactly like engine/hn/api.ts's in-memory caches.
const cache = new Map<string, { items: NewsItem[]; at: number }>()

const FETCH_TIMEOUT_MS = 12_000

async function fetchSourceCached(src: NewsSource, fresh: boolean): Promise<NewsItem[]> {
  const hit = cache.get(src.id)
  if (!fresh && hit && Date.now() - hit.at < src.intervalMs) return hit.items
  // settle → never throws, hard-capped; falls back to the stale list (or []).
  const fetched = keepGeneralAudienceNews(await settle(src.fetch(), hit?.items ?? [], FETCH_TIMEOUT_MS))
  if (fetched.length > 0) {
    cache.set(src.id, { items: fetched, at: Date.now() })
    return fetched
  }
  // Empty result (dead/blocked source): keep serving stale if we have it.
  return hit?.items ?? []
}

/** Strip protocol, `www.`, tracking params, and a trailing slash for dedup. */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Round-robin interleave: rank-1 of each source, then rank-2, … so the top of
 * every source surfaces near the top of the river. Dedup on normalized URL,
 * keeping the first (highest-ranked) instance. A single-source list passes
 * through in its original order.
 */
function mergeRiver(lists: NewsItem[][]): NewsItem[] {
  const out: NewsItem[] = []
  const seen = new Set<string>()
  const maxLen = lists.reduce((m, l) => Math.max(m, l.length), 0)
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      const item = list[i]
      if (!item) continue
      const key = normalizeUrl(item.url)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

/**
 * Aggregate the news feed for the active selection.
 * @param category active category chip ('all' = every source's river)
 * @param sourceId pin a single source (overrides category), or null for the river
 * @param fresh    bypass the TTL cache (pull-to-refresh)
 */
export async function fetchNews(
  category: NewsCategory,
  sourceId: string | null,
  fresh = false
): Promise<NewsItem[]> {
  const sources = sourceId
    ? sourcesFor('all').filter((s) => s.id === sourceId)
    : sourcesFor(category)
  const lists = await Promise.all(sources.map((s) => fetchSourceCached(s, fresh)))
  if (sources.length === 1) return lists[0] ?? []
  return mergeRiver(lists)
}

/** Reset the in-memory cache (test hook / hard refresh). */
export function clearNewsCache(): void {
  cache.clear()
}
