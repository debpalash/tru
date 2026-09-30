// Generic English RSS/Atom sources are the most reliable, CF-free, lowest-effort
// class of English news. Each is just a URL + the shared `parseFeed`. Verified
// shapes: The Verge (Atom), Ars Technica (RSS 2.0), BBC World (RSS 2.0).

import { parseFeed } from '../parse'
import { fetchText } from '../http'
import type { NewsItem } from '../types'

/** Build a fetcher that reads one feed URL and normalizes it under `sourceId`. */
export function makeRssFetcher(sourceId: string, feedUrl: string): () => Promise<NewsItem[]> {
  return async () => {
    const xml = await fetchText(feedUrl)
    return parseFeed(xml, sourceId, 30)
  }
}

export const fetchTheVerge = makeRssFetcher('theverge', 'https://www.theverge.com/rss/index.xml')
export const fetchArsTechnica = makeRssFetcher(
  'arstechnica',
  'https://feeds.arstechnica.com/arstechnica/index'
)
export const fetchBbcWorld = makeRssFetcher('bbc', 'https://feeds.bbci.co.uk/news/world/rss.xml')
export const fetchIndiaTheHindu = makeRssFetcher('thehindu', 'https://www.thehindu.com/news/national/feeder/default.rss')
export const fetchIndiaNdtv = makeRssFetcher('ndtv-india', 'https://feeds.feedburner.com/ndtvnews-india-news')
export const fetchIndiaExpress = makeRssFetcher('indianexpress', 'https://indianexpress.com/section/india/feed/')
export const fetchGuardianWorld = makeRssFetcher('guardian', 'https://www.theguardian.com/world/rss')
export const fetchNprNews = makeRssFetcher('npr', 'https://feeds.npr.org/1001/rss.xml')
export const fetchBbcUk = makeRssFetcher('bbc-uk', 'https://feeds.bbci.co.uk/news/uk/rss.xml')
export const fetchCbcCanada = makeRssFetcher('cbc-canada', 'https://www.cbc.ca/cmlink/rss-canada')
export const fetchSbsAustralia = makeRssFetcher('sbs-australia', 'https://www.sbs.com.au/news/feed')
export const fetchRnzNewZealand = makeRssFetcher('rnz-new-zealand', 'https://www.rnz.co.nz/rss/national.xml')
export const fetchCnaSingapore = makeRssFetcher('cna-singapore', 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416')
export const fetchScmp = makeRssFetcher('scmp', 'https://www.scmp.com/rss/91/feed')
export const fetchRappler = makeRssFetcher('rappler', 'https://www.rappler.com/feed/')
export const fetchNhkJapan = makeRssFetcher('nhk-japan', 'https://www3.nhk.or.jp/rss/news/cat0.xml')
export const fetchFrance24 = makeRssFetcher('france24', 'https://www.france24.com/en/rss')
export const fetchDwGermany = makeRssFetcher('dw-germany', 'https://rss.dw.com/rdf/rss-en-ger')
export const fetchLeMondeFrance = makeRssFetcher('lemonde-france', 'https://www.lemonde.fr/en/politics/rss_full.xml')
export const fetchAlJazeera = makeRssFetcher('aljazeera', 'https://www.aljazeera.com/xml/rss/all.xml')
export const fetchTheNational = makeRssFetcher('the-national', 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml')
export const fetchDailyMaverick = makeRssFetcher('daily-maverick', 'https://www.dailymaverick.co.za/dmrss/')
export const fetchRfiEnglish = makeRssFetcher('rfi-english', 'https://www.rfi.fr/en/rss')
export const fetchBuenosAiresHerald = makeRssFetcher('buenos-aires-herald', 'https://buenosairesherald.com/feed')
export const fetchMexicoNewsDaily = makeRssFetcher('mexico-news-daily', 'https://mexiconewsdaily.com/feed/')
