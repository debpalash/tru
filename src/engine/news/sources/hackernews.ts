// Hacker News source, reusing the existing native Firebase client
// (src/engine/hn/api.ts, imported read-only) rather than scraping the HTML that
// NewsNow scrapes. We take the top ~30 stories and normalize to NewsItem.

import { fetchStoryPage } from '../../hn/api'
import type { NewsItem } from '../types'

const HN_ITEM = 'https://news.ycombinator.com/item?id='

export async function fetchHackerNews(): Promise<NewsItem[]> {
  const page = await fetchStoryPage('top', 0, 30)
  return page.stories.map((s, i) => ({
    id: `hackernews:${s.id}`,
    sourceId: 'hackernews',
    title: s.title,
    // External article when present, else the HN discussion (Ask/Show/text posts).
    url: s.url ?? `${HN_ITEM}${s.id}`,
    // Always keep the comments reachable as the "mobile" alias.
    mobileUrl: `${HN_ITEM}${s.id}`,
    score: s.score,
    info: `${s.score} points`,
    time: s.time ? s.time * 1000 : undefined,
    rank: i + 1,
  }))
}
