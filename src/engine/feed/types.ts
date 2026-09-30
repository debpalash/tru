import type { NewsItem } from '../news/types'
import type { EvidenceRole } from '../news/types'
import type { XPost } from '../x/types'

export type UnifiedKind = 'news' | 'world' | 'hn' | 'x' | 'research' | 'media'
export type UnifiedFilter = 'all' | 'x' | 'news' | 'world' | 'research' | 'media'

export const UNIFIED_FILTERS: { key: UnifiedFilter; label: string }[] = [
  { key: 'all', label: 'Priority' },
  { key: 'x', label: 'X' },
  { key: 'news', label: 'News' },
  { key: 'world', label: 'World' },
  { key: 'research', label: 'Research' },
  { key: 'media', label: 'Media' },
]

export type EvidenceStatus = 'strong' | 'supported' | 'single-source' | 'primary' | 'insufficient'

export interface EvidenceLink {
  id: string
  itemId: string
  publisherId: string
  publisher: string
  short: string
  title: string
  url: string
  role: EvidenceRole
  relationship: 'origin' | 'corroborates'
  verifiedPublisher: boolean
}

export interface EvidenceAssessment {
  /** Headline-evidence score, not a blanket factuality rating for the article. */
  score: number
  status: EvidenceStatus
  label: string
  explanation: string
  links: EvidenceLink[]
  independentPublishers: number
  checkedAt: number
}

export type WebVerificationState =
  | { kind: 'loading' }
  | { kind: 'done'; matched: number; credits: number }
  | { kind: 'error'; message: string }

/** A deliberately small contract shared by every future feed producer. */
export interface UnifiedFeedItem {
  id: string
  kind: UnifiedKind
  sourceId: string
  sourceName: string
  sourceShort: string
  sourceColor: string
  title: string
  summary?: string
  meta?: string
  time?: number
  url?: string
  why: string
  evidence: EvidenceAssessment
  /** Original news item retained for agent citations and native open behavior. */
  news?: NewsItem
  /** Full native X payload, including media/polls/cards and account state. */
  xPost?: XPost
}

export interface AgentFeedResult {
  id: string
  kind: 'research'
  question: string
  answer: string
  providerLabel: string
  elapsedMs: number
  sources: NewsItem[]
  createdAt: number
}
