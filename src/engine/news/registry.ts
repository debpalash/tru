// The local source registry is the RN analog of NewsNow's source registry. Every
// P1 source is `provider: 'local'` (a ported fetch → parse → NewsItem[] fn).
//
// A future self-hosted NewsNow instance could add `provider: 'remote'` entries;
// the UI stays provider-agnostic because every source has the same NewsItem shape.

import type { EvidenceRole, NewsCategory, NewsSource, SourceCategory } from './types'
import { locationProfile } from '../location'
import { fetchHackerNews } from './sources/hackernews'
import { fetchGithubTrending } from './sources/github'
import { fetchProductHunt } from './sources/producthunt'
import {
  fetchTheVerge, fetchArsTechnica, fetchBbcWorld,
  fetchIndiaTheHindu, fetchIndiaNdtv, fetchIndiaExpress,
  fetchGuardianWorld, fetchNprNews,
  fetchAlJazeera, fetchBbcUk, fetchBuenosAiresHerald, fetchCbcCanada,
  fetchCnaSingapore, fetchDailyMaverick, fetchDwGermany, fetchFrance24,
  fetchLeMondeFrance, fetchMexicoNewsDaily, fetchNhkJapan, fetchRappler,
  fetchRfiEnglish, fetchRnzNewZealand, fetchSbsAustralia, fetchScmp,
  fetchTheNational,
} from './sources/rss'

const TEN_MIN = 600_000

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'hackernews',
    name: 'Hacker News',
    short: 'HN',
    category: 'tech',
    type: 'hottest',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#ff6600',
    homeUrl: 'https://news.ycombinator.com',
    evidenceRole: 'discovery',
    trustedHosts: ['news.ycombinator.com'],
    fetch: fetchHackerNews,
  },
  {
    id: 'github',
    name: 'GitHub Trending',
    short: 'GH',
    category: 'dev',
    type: 'hottest',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#8b949e',
    homeUrl: 'https://github.com/trending',
    evidenceRole: 'primary',
    trustedHosts: ['github.com'],
    fetch: fetchGithubTrending,
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    short: 'PH',
    category: 'tech',
    type: 'hottest',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#da552f',
    homeUrl: 'https://www.producthunt.com',
    evidenceRole: 'primary',
    trustedHosts: ['producthunt.com'],
    fetch: fetchProductHunt,
  },
  {
    id: 'theverge',
    name: 'The Verge',
    short: 'Verge',
    category: 'tech',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#5200ff',
    homeUrl: 'https://www.theverge.com',
    evidenceRole: 'editorial',
    trustedHosts: ['theverge.com'],
    fetch: fetchTheVerge,
  },
  {
    id: 'arstechnica',
    name: 'Ars Technica',
    short: 'Ars',
    category: 'tech',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#ff4e00',
    homeUrl: 'https://arstechnica.com',
    evidenceRole: 'editorial',
    trustedHosts: ['arstechnica.com'],
    fetch: fetchArsTechnica,
  },
  {
    id: 'bbc',
    name: 'BBC World',
    short: 'BBC',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#bb1919',
    homeUrl: 'https://www.bbc.com/news/world',
    evidenceRole: 'editorial',
    trustedHosts: ['bbc.com', 'bbc.co.uk'],
    fetch: fetchBbcWorld,
  },
  {
    id: 'thehindu',
    name: 'The Hindu India',
    short: 'Hindu',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#b21f24',
    homeUrl: 'https://www.thehindu.com/news/national/',
    evidenceRole: 'editorial',
    trustedHosts: ['thehindu.com'],
    coverage: { scope: 'national', countries: ['IN'] },
    fetch: fetchIndiaTheHindu,
  },
  {
    id: 'ndtv-india',
    name: 'NDTV India',
    short: 'NDTV',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#1b4d8c',
    homeUrl: 'https://www.ndtv.com/india',
    evidenceRole: 'editorial',
    trustedHosts: ['ndtv.com'],
    coverage: { scope: 'national', countries: ['IN'] },
    fetch: fetchIndiaNdtv,
  },
  {
    id: 'indianexpress',
    name: 'The Indian Express',
    short: 'IE',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#2d2d2d',
    homeUrl: 'https://indianexpress.com/section/india/',
    evidenceRole: 'editorial',
    trustedHosts: ['indianexpress.com'],
    coverage: { scope: 'national', countries: ['IN'] },
    fetch: fetchIndiaExpress,
  },
  {
    id: 'guardian',
    name: 'The Guardian World',
    short: 'Guardian',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#4b76c2',
    homeUrl: 'https://www.theguardian.com/world',
    evidenceRole: 'editorial',
    trustedHosts: ['theguardian.com'],
    fetch: fetchGuardianWorld,
  },
  {
    id: 'npr',
    name: 'NPR News',
    short: 'NPR',
    category: 'world',
    type: 'realtime',
    intervalMs: TEN_MIN,
    provider: 'local',
    color: '#d62021',
    homeUrl: 'https://www.npr.org/sections/news/',
    evidenceRole: 'editorial',
    trustedHosts: ['npr.org'],
    coverage: { scope: 'national', countries: ['US'] },
    fetch: fetchNprNews,
  },
  {
    id: 'bbc-uk', name: 'BBC UK', short: 'BBC', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#bb1919', homeUrl: 'https://www.bbc.com/news/uk', evidenceRole: 'editorial',
    canonicalPublisherId: 'bbc', trustedHosts: ['bbc.com', 'bbc.co.uk'], coverage: { scope: 'national', countries: ['GB'] }, fetch: fetchBbcUk,
  },
  {
    id: 'cbc-canada', name: 'CBC Canada', short: 'CBC', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#e11b22', homeUrl: 'https://www.cbc.ca/news/canada', evidenceRole: 'editorial',
    trustedHosts: ['cbc.ca'], coverage: { scope: 'national', countries: ['CA'] }, fetch: fetchCbcCanada,
  },
  {
    id: 'sbs-australia', name: 'SBS Australia', short: 'SBS', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#f5a623', homeUrl: 'https://www.sbs.com.au/news', evidenceRole: 'editorial',
    trustedHosts: ['sbs.com.au'], coverage: { scope: 'national', countries: ['AU'] }, fetch: fetchSbsAustralia,
  },
  {
    id: 'rnz-new-zealand', name: 'RNZ New Zealand', short: 'RNZ', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#cf202f', homeUrl: 'https://www.rnz.co.nz/news/national', evidenceRole: 'editorial',
    trustedHosts: ['rnz.co.nz'], coverage: { scope: 'national', countries: ['NZ'] }, fetch: fetchRnzNewZealand,
  },
  {
    id: 'cna-singapore', name: 'CNA Singapore', short: 'CNA', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#ad1f2d', homeUrl: 'https://www.channelnewsasia.com/singapore', evidenceRole: 'editorial',
    trustedHosts: ['channelnewsasia.com'], coverage: { scope: 'national', countries: ['SG'], regions: ['asia'] }, fetch: fetchCnaSingapore,
  },
  {
    id: 'scmp', name: 'South China Morning Post', short: 'SCMP', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#066b8f', homeUrl: 'https://www.scmp.com/news', evidenceRole: 'editorial',
    trustedHosts: ['scmp.com'], coverage: { scope: 'regional', countries: ['HK'], regions: ['asia'] }, fetch: fetchScmp,
  },
  {
    id: 'rappler', name: 'Rappler Philippines', short: 'RPL', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#f04f3d', homeUrl: 'https://www.rappler.com', evidenceRole: 'editorial',
    trustedHosts: ['rappler.com'], coverage: { scope: 'national', countries: ['PH'] }, fetch: fetchRappler,
  },
  {
    id: 'nhk-japan', name: 'NHK Japan', short: 'NHK', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#b51937', homeUrl: 'https://www3.nhk.or.jp/news/', evidenceRole: 'editorial',
    trustedHosts: ['nhk.or.jp'], coverage: { scope: 'national', countries: ['JP'] }, fetch: fetchNhkJapan,
  },
  {
    id: 'france24', name: 'France 24', short: 'F24', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#00a7e1', homeUrl: 'https://www.france24.com/en/', evidenceRole: 'editorial',
    trustedHosts: ['france24.com'], coverage: { scope: 'regional', regions: ['europe'] }, fetch: fetchFrance24,
  },
  {
    id: 'dw-germany', name: 'DW Germany', short: 'DW', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#1495d1', homeUrl: 'https://www.dw.com/en/germany/s-1432', evidenceRole: 'editorial',
    trustedHosts: ['dw.com'], coverage: { scope: 'national', countries: ['DE'] }, fetch: fetchDwGermany,
  },
  {
    id: 'lemonde-france', name: 'Le Monde France', short: 'LM', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#1f4d78', homeUrl: 'https://www.lemonde.fr/en/france/', evidenceRole: 'editorial',
    trustedHosts: ['lemonde.fr'], coverage: { scope: 'national', countries: ['FR'] }, fetch: fetchLeMondeFrance,
  },
  {
    id: 'aljazeera', name: 'Al Jazeera', short: 'AJ', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#d4a017', homeUrl: 'https://www.aljazeera.com', evidenceRole: 'editorial',
    trustedHosts: ['aljazeera.com'], coverage: { scope: 'regional', regions: ['middle-east'] }, fetch: fetchAlJazeera,
  },
  {
    id: 'the-national', name: 'The National', short: 'TN', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#2d6f87', homeUrl: 'https://www.thenationalnews.com', evidenceRole: 'editorial',
    trustedHosts: ['thenationalnews.com'], coverage: { scope: 'national', countries: ['AE'], regions: ['middle-east'] }, fetch: fetchTheNational,
  },
  {
    id: 'daily-maverick', name: 'Daily Maverick', short: 'DM', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#e15a2b', homeUrl: 'https://www.dailymaverick.co.za', evidenceRole: 'editorial',
    trustedHosts: ['dailymaverick.co.za'], coverage: { scope: 'national', countries: ['ZA'], regions: ['africa'] }, fetch: fetchDailyMaverick,
  },
  {
    id: 'rfi-english', name: 'RFI English', short: 'RFI', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#e2001a', homeUrl: 'https://www.rfi.fr/en/', evidenceRole: 'editorial',
    trustedHosts: ['rfi.fr'], coverage: { scope: 'regional', regions: ['africa'] }, fetch: fetchRfiEnglish,
  },
  {
    id: 'buenos-aires-herald', name: 'Buenos Aires Herald', short: 'BAH', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#4d78a8', homeUrl: 'https://buenosairesherald.com', evidenceRole: 'editorial',
    trustedHosts: ['buenosairesherald.com'], coverage: { scope: 'national', countries: ['AR'], regions: ['latin-america'] }, fetch: fetchBuenosAiresHerald,
  },
  {
    id: 'mexico-news-daily', name: 'Mexico News Daily', short: 'MND', category: 'world', type: 'realtime', intervalMs: TEN_MIN,
    provider: 'local', color: '#167b54', homeUrl: 'https://mexiconewsdaily.com', evidenceRole: 'editorial',
    trustedHosts: ['mexiconewsdaily.com'], coverage: { scope: 'national', countries: ['MX'], regions: ['latin-america'] }, fetch: fetchMexicoNewsDaily,
  },
]

export interface TrustedPublisher {
  id: string
  name: string
  short: string
  evidenceRole: EvidenceRole
  trustedHosts: string[]
}

/**
 * High-signal publishers used for explicit web verification and agent research.
 * These are evidence-only producers: they never become background feed fetches.
 */
const WEB_ONLY_PUBLISHERS: TrustedPublisher[] = [
  { id: 'x', name: 'X', short: 'X', evidenceRole: 'discovery', trustedHosts: ['x.com', 'twitter.com'] },
  { id: 'reuters', name: 'Reuters', short: 'Reuters', evidenceRole: 'editorial', trustedHosts: ['reuters.com'] },
  { id: 'ap', name: 'Associated Press', short: 'AP', evidenceRole: 'editorial', trustedHosts: ['apnews.com'] },
  { id: 'afp', name: 'Agence France-Presse', short: 'AFP', evidenceRole: 'editorial', trustedHosts: ['afp.com'] },
  { id: 'nature', name: 'Nature', short: 'Nature', evidenceRole: 'editorial', trustedHosts: ['nature.com'] },
  { id: 'science', name: 'Science', short: 'Science', evidenceRole: 'editorial', trustedHosts: ['science.org'] },
  { id: 'who', name: 'World Health Organization', short: 'WHO', evidenceRole: 'primary', trustedHosts: ['who.int'] },
  { id: 'cdc', name: 'US Centers for Disease Control', short: 'CDC', evidenceRole: 'primary', trustedHosts: ['cdc.gov'] },
  { id: 'nih', name: 'US National Institutes of Health', short: 'NIH', evidenceRole: 'primary', trustedHosts: ['nih.gov'] },
  { id: 'nasa', name: 'NASA', short: 'NASA', evidenceRole: 'primary', trustedHosts: ['nasa.gov'] },
  { id: 'un', name: 'United Nations', short: 'UN', evidenceRole: 'primary', trustedHosts: ['un.org'] },
  { id: 'rbi', name: 'Reserve Bank of India', short: 'RBI', evidenceRole: 'primary', trustedHosts: ['rbi.org.in'] },
  { id: 'pib', name: 'Press Information Bureau India', short: 'PIB', evidenceRole: 'primary', trustedHosts: ['pib.gov.in'] },
  { id: 'sec', name: 'US Securities and Exchange Commission', short: 'SEC', evidenceRole: 'primary', trustedHosts: ['sec.gov'] },
  { id: 'fda', name: 'US Food and Drug Administration', short: 'FDA', evidenceRole: 'primary', trustedHosts: ['fda.gov'] },
  { id: 'eu', name: 'European Commission', short: 'EU', evidenceRole: 'primary', trustedHosts: ['ec.europa.eu'] },
]

export const TRUSTED_PUBLISHERS: TrustedPublisher[] = [...NEWS_SOURCES, ...WEB_ONLY_PUBLISHERS]

function hostMatches(host: string, trustedHost: string): boolean {
  return host === trustedHost || host.endsWith(`.${trustedHost}`)
}

export function getTrustedPublisher(id: string): TrustedPublisher | undefined {
  const canonical = NEWS_SOURCES.find((source) => source.id === id)?.canonicalPublisherId ?? id
  return TRUSTED_PUBLISHERS.find((publisher) => publisher.id === canonical)
}

export function trustedPublisherForUrl(url: string): TrustedPublisher | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return undefined
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    return TRUSTED_PUBLISHERS.find((publisher) =>
      publisher.trustedHosts.some((trusted) => hostMatches(host, trusted)),
    )
  } catch {
    return undefined
  }
}

export function trustedSearchDomains(): string[] {
  return [...new Set(
    TRUSTED_PUBLISHERS
      .filter((publisher) => publisher.evidenceRole !== 'discovery')
      .flatMap((publisher) => publisher.trustedHosts),
  )]
}

export function getSource(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id)
}

export function sourceLocationAffinity(source: NewsSource | undefined): number {
  const coverage = source?.coverage
  if (!coverage || coverage.scope === 'global') return 0
  const profile = locationProfile()
  if (coverage.countries?.includes(profile.code)) return 2
  if (coverage.regions?.includes(profile.region)) return 1
  return -1
}

export function sourceCoverageLabel(source: NewsSource): string {
  const coverage = source.coverage
  if (!coverage || coverage.scope === 'global') return 'Global'
  if (coverage.countries?.length) return coverage.countries.join(', ')
  return coverage.regions?.map((region) => region.replace('-', ' ')).join(', ') ?? 'Regional'
}

/** Sources in a category ('all' = every source). */
export function sourcesFor(category: NewsCategory): NewsSource[] {
  const categorySources = category === 'all' ? NEWS_SOURCES : NEWS_SOURCES.filter((source) => source.category === category)
  return categorySources.filter((source) => source.category !== 'world' || sourceLocationAffinity(source) >= 0)
}

/** Categories that actually have sources, in a stable order, 'all' first. */
export function activeCategories(): NewsCategory[] {
  const order: SourceCategory[] = ['tech', 'dev', 'world']
  const present = order.filter((c) => NEWS_SOURCES.some((s) => s.category === c))
  return ['all', ...present]
}
