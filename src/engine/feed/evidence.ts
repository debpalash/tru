import { getTrustedPublisher, trustedPublisherForUrl, type TrustedPublisher } from '../news/registry'
import type { EvidenceRole, NewsItem } from '../news/types'
import type { EvidenceAssessment, EvidenceLink, EvidenceStatus } from './types'

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'amid', 'among', 'and', 'are', 'because',
  'been', 'before', 'being', 'but', 'could', 'from', 'have', 'into', 'its', 'latest', 'more',
  'deadly', 'devastating', 'latest', 'likely', 'new', 'news', 'now', 'official', 'over',
  'reported', 'report', 'says', 'say', 'scientist', 'scientists', 'that', 'the', 'their',
  'this', 'through', 'under', 'update', 'was', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'will', 'with', 'would', 'your',
])

const MAX_MATCH_AGE_MS = 5 * 24 * 60 * 60 * 1000
const MATCH_THRESHOLD = 0.66
const NEGATION = /\b(?:no|not|denies?|denied|false|fake|rejects?|rejected)\b/i

export function isVerifiedPublisherUrl(url: string, source: TrustedPublisher): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    return source.trustedHosts.some((trusted) => host === trusted || host.endsWith(`.${trusted}`))
  } catch {
    return false
  }
}

function canonicalToken(token: string): string {
  let value = token
  if (value.length > 5 && value.endsWith('ies')) value = `${value.slice(0, -3)}y`
  else if (value.length > 5 && value.endsWith('ing')) value = value.slice(0, -3)
  else if (value.length > 5 && value.endsWith('ed')) value = value.slice(0, -2)
  else if (value.length > 4 && value.endsWith('s')) value = value.slice(0, -1)
  return value.length > 6 ? value.slice(0, 6) : value
}

function headlineTokens(title: string): Set<string> {
  const normalized = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .match(/[a-z0-9]+/g) ?? []
  return new Set(
    normalized
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .map(canonicalToken),
  )
}

export function headlineSimilarity(left: string, right: string): number {
  if (left.trim().endsWith('?')) return 0
  const a = headlineTokens(left)
  const b = headlineTokens(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  if (shared < 3 || NEGATION.test(left) !== NEGATION.test(right)) return 0
  const targetNumbers = left.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []
  const evidenceNumbers = new Set(right.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
  if (targetNumbers.some((number) => !evidenceNumbers.has(number))) return 0
  const targetCoverage = shared / a.size
  const evidenceCoverage = shared / b.size
  // This is intentionally directional: a candidate may corroborate this card
  // only when it covers most of this card's claim. Merely covering the same
  // developing event must not raise a narrower headline's score.
  if (targetCoverage < 0.72 || evidenceCoverage < 0.5) return 0
  const jaccard = shared / (a.size + b.size - shared)
  return (targetCoverage * 0.55) + (evidenceCoverage * 0.2) + (jaccard * 0.25)
}

function makeLink(
  item: NewsItem,
  source: TrustedPublisher,
  url: string,
  relationship: EvidenceLink['relationship'],
): EvidenceLink | null {
  if (!isVerifiedPublisherUrl(url, source)) return null
  return {
    id: `${item.id}:${source.id}:${relationship}`,
    itemId: item.id,
    publisherId: source.id,
    publisher: source.name,
    short: source.short,
    title: item.title,
    url,
    role: source.evidenceRole,
    relationship,
    verifiedPublisher: true,
  }
}

function originLinks(item: NewsItem): EvidenceLink[] {
  const source = getTrustedPublisher(item.sourceId)
  if (!source) return []
  const links: EvidenceLink[] = []

  // HN often points to a publisher article while mobileUrl retains its discussion.
  // If that article belongs to a pinned publisher, expose both pieces of provenance.
  const directPublisher = trustedPublisherForUrl(item.url)
  if (directPublisher && directPublisher.id !== source.id) {
    const direct = makeLink(item, directPublisher, item.url, 'origin')
    if (direct) links.push(direct)
  }

  const ownUrl = item.sourceId === 'hackernews' ? (item.mobileUrl ?? item.url) : item.url
  const own = makeLink(item, source, ownUrl, 'origin')
  if (own && !links.some((link) => link.url === own.url)) links.push(own)
  return links
}

function timeCompatible(left?: number, right?: number): boolean {
  if (!left || !right) return true
  return Math.abs(left - right) <= MAX_MATCH_AGE_MS
}

function statusFor(editorialCount: number, primaryCount: number): EvidenceStatus {
  if (editorialCount >= 3) return 'strong'
  if (editorialCount === 2) return 'supported'
  if (editorialCount === 1) return 'single-source'
  if (primaryCount > 0) return 'primary'
  return 'insufficient'
}

function labelFor(status: EvidenceStatus): string {
  if (status === 'strong') return 'Strong evidence'
  if (status === 'supported') return 'Supported'
  if (status === 'single-source') return 'Single source'
  if (status === 'primary') return 'Primary claim'
  return 'Insufficient'
}

function scoreFor(links: EvidenceLink[], item: NewsItem): number {
  const editorialCount = new Set(links.filter((link) => link.role === 'editorial').map((link) => link.publisherId)).size
  const primaryCount = new Set(links.filter((link) => link.role === 'primary').map((link) => link.publisherId)).size
  const discoveryCount = links.some((link) => link.role === 'discovery') ? 1 : 0
  const age = item.time ? Math.max(0, Date.now() - item.time) : Number.POSITIVE_INFINITY
  const freshness = age <= 72 * 60 * 60 * 1000 ? 4 : age <= MAX_MATCH_AGE_MS ? 2 : 0

  let score = editorialCount ? 54 : primaryCount ? 45 : discoveryCount ? 22 : 8
  if (editorialCount >= 2) score += 22
  if (editorialCount >= 3) score += 11
  if (editorialCount >= 4) score += 5
  score += freshness

  const cap = editorialCount >= 3 ? 94 : editorialCount === 2 ? 82 : editorialCount === 1 ? 60 : primaryCount ? 54 : 30
  return Math.min(score, cap)
}

function explanationFor(status: EvidenceStatus, count: number): string {
  if (status === 'strong') return `The headline aligns across ${count} independent editorial publishers with verified links.`
  if (status === 'supported') return 'The headline aligns across 2 independent editorial publishers with verified links.'
  if (status === 'single-source') return 'The publisher link is verified, but no independent matching report was found.'
  if (status === 'primary') return 'This is a verified first-party source; independent editorial confirmation was not found.'
  return 'This is a discovery source and no independent editorial confirmation was found.'
}

function assessItem(item: NewsItem, items: NewsItem[], checkedAt: number): EvidenceAssessment {
  const origins = originLinks(item)
  const originPublishers = new Set(origins.map((link) => link.publisherId))
  const candidates = new Map<string, { link: EvidenceLink; similarity: number }>()

  for (const candidate of items) {
    if (candidate.id === item.id || !timeCompatible(item.time, candidate.time)) continue
    const similarity = headlineSimilarity(item.title, candidate.title)
    if (similarity < MATCH_THRESHOLD) continue
    const link = originLinks(candidate).find((candidateLink) => candidateLink.role !== 'discovery')
    if (!link || originPublishers.has(link.publisherId)) continue
    const current = candidates.get(link.publisherId)
    if (!current || similarity > current.similarity) {
      candidates.set(link.publisherId, { link: { ...link, relationship: 'corroborates' }, similarity })
    }
  }

  const corroborations = [...candidates.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ link }) => link)
  const links = [...origins, ...corroborations]
  const editorialCount = new Set(links.filter((link) => link.role === 'editorial').map((link) => link.publisherId)).size
  const primaryCount = new Set(links.filter((link) => link.role === 'primary').map((link) => link.publisherId)).size
  const status = statusFor(editorialCount, primaryCount)

  return {
    score: scoreFor(links, item),
    status,
    label: labelFor(status),
    explanation: explanationFor(status, editorialCount),
    links,
    independentPublishers: editorialCount,
    checkedAt,
  }
}

export function assessFeedEvidence(items: NewsItem[]): Map<string, EvidenceAssessment> {
  const checkedAt = Date.now()
  return new Map(items.map((item) => [item.id, assessItem(item, items, checkedAt)]))
}

export function evidenceRoleWeight(role: EvidenceRole): number {
  if (role === 'editorial') return 3
  if (role === 'primary') return 2
  return 1
}
