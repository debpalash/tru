import type { XPost } from '../x/types'
import type { NewsRegion } from '../location'

// News-feed domain types. A superset of NewsNow's `NewsItem` (we keep its field
// names so ported fetchers stay near-verbatim) plus the few fields the RN UI and
// the unseen-badge machinery need. `NewsItem` is its own type, not a Tweet.

/** Top-level category chips in the switcher. 'all' is the merged river. */
export type NewsCategory = 'all' | 'tech' | 'dev' | 'world'

/** A category a source can actually belong to (everything except the 'all' river). */
export type SourceCategory = Exclude<NewsCategory, 'all'>
export type EvidenceRole = 'editorial' | 'primary' | 'discovery'

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  all: 'All',
  tech: 'Tech',
  dev: 'Dev',
  world: 'World',
}

/**
 * One hot-list row. `id` is globally unique (fetchers prefix it with the source
 * id, e.g. `hackernews:12345`) so a merged river can key a FlashList directly
 * and cross-source dedup keys on the normalized `url` instead.
 */
export interface NewsItem {
  id: string
  sourceId: string
  title: string
  url: string
  /** Optional mobile-optimized URL; preferred when opening. */
  mobileUrl?: string
  /** Parsed from the badge when numeric (points / stars / votes). */
  score?: number
  /** Raw badge string, e.g. "1234 points", "★ 900 today". */
  info?: string
  /** Description / tagline (row subtitle). */
  hover?: string
  /** pubDate coerced to epoch ms (undefined for pure hot-lists). */
  time?: number
  /** 1-based position within its source's returned list. */
  rank?: number
  // TODO(P2): `diff` is the rank delta since last poll, for a ▲/▼ indicator. Needs
  // the previous poll's ranks persisted; deferred with the topic-poll work.
  diff?: number
  /** Native X payload retained when this row came from the signed-in timeline. */
  xPost?: XPost
}

/**
 * A source definition matching the RN analog of NewsNow's `Source`. P1 sources are all
 * `provider: 'local'` (a ported fetch → parse → NewsItem[] fn). The `remote`
 * provider (a self-hosted NewsNow `/api/s?id=` base) is a P3 hook, not wired.
 */
export interface NewsSource {
  id: string
  /** Full display name, e.g. "Hacker News". */
  name: string
  /** Short badge label, e.g. "HN" / "GH" / "PH". */
  short: string
  category: SourceCategory
  type: 'hottest' | 'realtime'
  /** Refresh cadence in ms (default 600_000 = 10 min, matching NewsNow). */
  intervalMs: number
  /** 'local' = ported fetcher (P1); 'remote' = self-hosted API (P3, unused). */
  provider: 'local' | 'remote'
  /** Badge tint. */
  color: string
  homeUrl?: string
  /** How this producer may contribute to a headline-evidence assessment. */
  evidenceRole: EvidenceRole
  /** Canonical publisher id when two feeds come from the same newsroom. */
  canonicalPublisherId?: string
  /** Publisher-controlled hosts accepted as verified citation targets. */
  trustedHosts: string[]
  /** Geographic fit used only on device. No coordinates leave the app. */
  coverage?: {
    scope: 'global' | 'regional' | 'national'
    countries?: string[]
    regions?: NewsRegion[]
  }
  /** Local sources only. Returns a normalized, ranked list (never throws because the
   *  aggregator wraps it, but fetchers should still fail soft to []). */
  fetch: () => Promise<NewsItem[]>
}
