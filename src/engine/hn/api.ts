// Hacker News API client (Firebase v0, no auth).
//
// Responsibilities:
//  - fetch the story-id arrays per StoryType (cached with a short TTL)
//  - hydrate item ids into normalized `Story` rows in bounded-concurrency batches
//    (a story feed is ~500 ids; we only ever hydrate the visible slice)
//  - decode the HTML that HN returns in comment / Ask-HN `text`
//
// Caching is in-memory only so HN stays self-sufficient (a persisted cache
// helper may land under src/engine/cache/ later, but we don't depend on it).

import { isGeneralAudienceText } from '../news/safety'
import { privacyFetch } from '../privacy/transport'
import type { Comment, RawItem, Story, StoryType } from './types'
import { STORY_TYPES } from './types'

const BASE = 'https://hacker-news.firebaseio.com/v0'

// ---- caches ----------------------------------------------------------------

// Story-id arrays per feed, with a timestamp so we can re-pull periodically.
const idListCache = new Map<StoryType, { ids: number[]; at: number }>()
const ID_LIST_TTL = 60_000 // 1 min; the front page moves slowly

// Individual hydrated items, keyed by id. Shared across stories + comments so a
// comment fetched here is reused by the thread loader and vice-versa.
const itemCache = new Map<number, RawItem>()

function endpointFor(type: StoryType): string {
  const meta = STORY_TYPES.find((s) => s.key === type)
  return meta ? meta.endpoint : 'topstories'
}

// ---- low-level fetch --------------------------------------------------------

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await privacyFetch(url, { signal })
  if (!res.ok) throw new Error(`HN ${res.status} ${url}`)
  return (await res.json()) as T
}

/** Fetch (and cache) a single raw item. Deduped by the item cache. */
export async function fetchItem(id: number, signal?: AbortSignal): Promise<RawItem | null> {
  const cached = itemCache.get(id)
  if (cached) return cached
  const item = await getJson<RawItem | null>(`${BASE}/item/${id}.json`, signal)
  if (item) itemCache.set(id, item)
  return item
}

/** Get the ordered id array for a feed, cached for ID_LIST_TTL. */
export async function fetchStoryIds(type: StoryType, fresh = false): Promise<number[]> {
  const cached = idListCache.get(type)
  if (!fresh && cached && Date.now() - cached.at < ID_LIST_TTL) return cached.ids
  const ids = await getJson<number[]>(`${BASE}/${endpointFor(type)}.json`)
  idListCache.set(type, { ids: ids ?? [], at: Date.now() })
  return ids ?? []
}

// ---- bounded-concurrency map ------------------------------------------------

/**
 * Run `worker` over `items` with at most `limit` in flight at once. Preserves
 * input order in the result. Keeps a fat id-list from opening 500 sockets.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++
      if (i >= items.length) break
      out[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return out
}

// ---- normalization ----------------------------------------------------------

function domainOf(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const host = new URL(url).hostname
    return host.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function toStory(item: RawItem): Story {
  return {
    id: item.id,
    type: item.type,
    title: item.title ?? '(untitled)',
    url: item.url,
    domain: domainOf(item.url),
    by: item.by ?? 'unknown',
    time: item.time ?? 0,
    score: item.score ?? 0,
    commentCount: item.descendants ?? 0,
    text: item.text ? decodeHtml(item.text) : undefined,
    kids: item.kids ?? [],
  }
}

/**
 * Hydrate one page of stories: slice `ids[offset .. offset+limit]`, fetch the
 * items with bounded concurrency, drop dead/deleted, and normalize. Returns the
 * rows plus the next offset for infinite scroll.
 */
export async function fetchStoryPage(
  type: StoryType,
  offset: number,
  pageSize: number,
  fresh = false
): Promise<{ stories: Story[]; nextOffset: number; total: number }> {
  const ids = await fetchStoryIds(type, fresh && offset === 0)
  const slice = ids.slice(offset, offset + pageSize)
  const items = await mapPool(slice, 8, (id) => fetchItem(id))
  const stories = items
    .filter((it): it is RawItem => !!it && !it.dead && !it.deleted)
    .map(toStory)
  return { stories, nextOffset: offset + slice.length, total: ids.length }
}

// ---- HTML decoding ----------------------------------------------------------

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#47;': '/',
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * HN comment/Ask `text` is a small HTML subset: `<p>` paragraph breaks, `<i>`,
 * `<a href>` links, `<pre><code>` blocks, and numeric/named entities. We render
 * as plain text, so: turn `<p>` into blank lines, strip other tags (keeping the
 * link href text), and decode entities. Newlines are preserved for the UI.
 */
export function decodeHtml(html: string): string {
  let s = html
  // Paragraph breaks -> double newline.
  s = s.replace(/<p>/gi, '\n\n')
  // Keep the visible href for anchors when it differs from the label; simplest
  // correct-enough approach is to just drop the tags and keep inner text.
  s = s.replace(/<a\b[^>]*>/gi, '').replace(/<\/a>/gi, '')
  // Preserve code/pre newlines, then strip the tags.
  s = s.replace(/<\/?(pre|code)>/gi, '')
  // Drop any remaining tags (<i>, <b>, etc.).
  s = s.replace(/<[^>]+>/g, '')
  // Decode named entities.
  s = s.replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, (m) => {
    const named = ENTITIES[m.toLowerCase()]
    if (named) return named
    const hex = /^&#x([0-9a-f]+);$/i.exec(m)
    if (hex) return safeCodePoint(parseInt(hex[1], 16))
    const dec = /^&#([0-9]+);$/.exec(m)
    if (dec) return safeCodePoint(parseInt(dec[1], 10))
    return m
  })
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** Test hook / cache reset (used by refresh). */
export function clearHnCache(): void {
  idListCache.clear()
  itemCache.clear()
}

/** Bounded breadth-first thread hydration; dead and explicit rows never reach UI. */
export async function fetchThread(storyId: number, maxComments = 50): Promise<{ story: Story; comments: Comment[] }> {
  const rawStory = await fetchItem(storyId)
  if (!rawStory) throw new Error('HN story not found.')
  const story = toStory(rawStory)
  const queue = [...story.kids]
  const rawComments = new Map<number, RawItem>()
  while (queue.length && rawComments.size < maxComments) {
    const batch = queue.splice(0, Math.min(10, maxComments - rawComments.size))
    const rows = await mapPool(batch, 6, (id) => fetchItem(id))
    for (const row of rows) {
      if (!row || row.dead || row.deleted || row.type !== 'comment') continue
      const text = decodeHtml(row.text ?? '')
      if (!text || !isGeneralAudienceText(text)) continue
      rawComments.set(row.id, { ...row, text })
      queue.push(...(row.kids ?? []))
    }
  }
  const build = (id: number, depth: number): Comment | null => {
    const row = rawComments.get(id)
    if (!row) return null
    return {
      id: row.id,
      by: row.by ?? 'unknown',
      time: row.time ?? 0,
      text: row.text ?? '',
      kids: row.kids ?? [],
      depth,
      replies: (row.kids ?? []).map((child) => build(child, depth + 1)).filter((value): value is Comment => Boolean(value)),
    }
  }
  return { story, comments: story.kids.map((id) => build(id, 0)).filter((value): value is Comment => Boolean(value)) }
}
