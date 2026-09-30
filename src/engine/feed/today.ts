import { getSource, sourceLocationAffinity } from '../news/registry'
import type { NewsItem } from '../news/types'
import { assessFeedEvidence } from './evidence'
import type { EvidenceAssessment, UnifiedFeedItem, UnifiedFilter } from './types'

const HN_ID = 'hackernews'
const MEDIA_HINT = /\bvideo|podcast|watch|listen|interview|documentary|photos?|visual|explainer\b/i

export function newsToUnified(item: NewsItem, evidence?: EvidenceAssessment): UnifiedFeedItem {
  const source = getSource(item.sourceId)
  const kind = item.sourceId === 'x'
    ? 'x'
    : item.sourceId === HN_ID
      ? 'hn'
      : MEDIA_HINT.test(`${item.title} ${item.hover ?? ''}`)
        ? 'media'
        : source?.category === 'world' ? 'world' : 'news'
  const why = kind === 'world'
    ? 'A recent update from a trusted world-news source.'
    : kind === 'hn'
      ? 'A highly ranked technology discussion from Hacker News.'
      : kind === 'x'
        ? 'A recent post from your authenticated X timeline. Treat it as a claim until corroborated.'
        : kind === 'media'
          ? 'A current audio, video, or visual treatment from a trusted publisher.'
        : 'A leading item from one of your trusted feeds.'

  return {
    id: item.id,
    kind,
    sourceId: item.sourceId,
    sourceName: source?.name ?? (item.sourceId === 'x' ? item.info ?? 'X' : item.sourceId),
    sourceShort: source?.short ?? (item.sourceId === 'x' ? 'X' : item.sourceId),
    sourceColor: source?.color ?? (item.sourceId === 'x' ? '#d9e5f3' : '#788ba4'),
    title: item.title,
    summary: item.hover,
    meta: item.info,
    time: item.time,
    url: item.mobileUrl ?? item.url,
    why,
    evidence: evidence ?? assessFeedEvidence([item]).get(item.id)!,
    news: item,
    xPost: item.xPost,
  }
}

export function buildTodayFeed(items: NewsItem[], evidencePool: NewsItem[] = items): UnifiedFeedItem[] {
  const evidence = assessFeedEvidence(evidencePool)
  return items.map((item) => newsToUnified(item, evidence.get(item.id)))
}

export function filterTodayFeed(items: UnifiedFeedItem[], filter: UnifiedFilter): UnifiedFeedItem[] {
  if (filter === 'all') return items
  if (filter === 'news') return items.filter((item) => item.kind === 'news' || item.kind === 'hn')
  return items.filter((item) => item.kind === filter)
}

export function rankSmartFeed(items: UnifiedFeedItem[]): UnifiedFeedItem[] {
  return [...items].sort((a, b) =>
    ((b.evidence.score + Math.max(0, sourceLocationAffinity(getSource(b.sourceId)!)) * 6)
      - (a.evidence.score + Math.max(0, sourceLocationAffinity(getSource(a.sourceId)!)) * 6))
    || ((b.time ?? 0) - (a.time ?? 0)),
  )
}

/** One Smart-mix card per corroborated claim; citation links retain every report. */
export function collapseCorroboratedFeed(items: UnifiedFeedItem[]): UnifiedFeedItem[] {
  const hidden = new Set<string>()
  const result: UnifiedFeedItem[] = []
  for (const item of items) {
    if (hidden.has(item.id)) continue
    result.push(item)
    for (const link of item.evidence.links) {
      if (link.relationship === 'corroborates') hidden.add(link.itemId)
    }
  }
  return result
}

/** Pick three genuinely different signals for the compact scan card. */
export function pickBriefItems(items: UnifiedFeedItem[], limit = 3): UnifiedFeedItem[] {
  const candidates = collapseCorroboratedFeed(rankSmartFeed(items))
  const picked: UnifiedFeedItem[] = []
  const sources = new Set<string>()
  const kinds = new Set<string>()

  for (const item of candidates) {
    if (picked.length >= limit) break
    if (sources.has(item.sourceId)) continue
    if (kinds.has(item.kind) && candidates.some((candidate) => !kinds.has(candidate.kind) && !sources.has(candidate.sourceId))) {
      continue
    }
    picked.push(item)
    sources.add(item.sourceId)
    kinds.add(item.kind)
  }

  if (picked.length < limit) {
    for (const item of candidates) {
      if (picked.length >= limit) break
      if (picked.some((candidate) => candidate.id === item.id)) continue
      picked.push(item)
    }
  }
  return picked
}
