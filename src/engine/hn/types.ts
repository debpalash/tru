// Hacker News domain types + the raw shapes the Firebase v0 API returns.
//
// The v0 API (https://hacker-news.firebaseio.com/v0) is a single polymorphic
// `item` endpoint: stories, comments, jobs, polls and "Ask/Show HN" text posts
// all come back as the same JSON object, discriminated by `type`. We normalize
// the subset we render into `Story` and `Comment` below.

/** The six story feeds HN exposes as id-array endpoints. */
export type StoryType = 'top' | 'new' | 'best' | 'ask' | 'show' | 'job'

/** Segmented-switcher metadata for the feed header (label + Firebase path). */
export interface StoryTypeMeta {
  key: StoryType
  label: string
  /** Endpoint stem, e.g. `topstories` -> /v0/topstories.json */
  endpoint: string
}

export const STORY_TYPES: StoryTypeMeta[] = [
  { key: 'top', label: 'Top', endpoint: 'topstories' },
  { key: 'new', label: 'New', endpoint: 'newstories' },
  { key: 'best', label: 'Best', endpoint: 'beststories' },
  { key: 'ask', label: 'Ask', endpoint: 'askstories' },
  { key: 'show', label: 'Show', endpoint: 'showstories' },
  { key: 'job', label: 'Jobs', endpoint: 'jobstories' },
]

/**
 * Raw item as returned by /v0/item/{id}.json. Every field is optional because
 * the endpoint is polymorphic and deleted/dead items omit most of them.
 */
export interface RawItem {
  id: number
  type?: 'story' | 'comment' | 'job' | 'poll' | 'pollopt'
  by?: string
  time?: number // unix seconds
  text?: string // HTML (comments, Ask/Show HN body)
  title?: string
  url?: string
  score?: number
  descendants?: number // total comment count (stories only)
  kids?: number[] // child ids, in display order
  parent?: number
  dead?: boolean
  deleted?: boolean
}

/** A normalized HN story row for the feed / story header. */
export interface Story {
  id: number
  type: RawItem['type']
  title: string
  /** External article URL (absent for Ask HN / text posts). */
  url?: string
  /** Bare domain of `url` (e.g. "github.com"), for the row's source chip. */
  domain?: string
  by: string
  time: number
  score: number
  /** Total comments in the thread (HN's `descendants`). */
  commentCount: number
  /** Decoded plaintext body for Ask/Show HN self-posts (no external url). */
  text?: string
  /** Immediate child comment ids (root of the thread). */
  kids: number[]
}

/** A normalized, tree-shaped HN comment. */
export interface Comment {
  id: number
  by: string
  time: number
  /** Decoded, tag-simplified comment body (newlines preserved). */
  text: string
  /** Child comment ids (unloaded until expanded). */
  kids: number[]
  /** Nesting depth from the story root (root comments = 0). */
  depth: number
  dead?: boolean
  deleted?: boolean
  /** Loaded child comments; empty until this node is hydrated. */
  replies: Comment[]
}
