// Product Hunt source using the public Atom feed at producthunt.com/feed (no token
// needed; NewsNow's default path too). The feed's `<content>` is the product
// tagline + Discussion/Link anchors; parseFeed pulls title + link + tagline.
// Vote counts (`△ N`) require the GraphQL API + PRODUCTHUNT_API_TOKEN, which is a
// later enhancement, so P1 rows show the tagline only (no score).

import { parseFeed } from '../parse'
import { fetchText } from '../http'
import type { NewsItem } from '../types'

const FEED_URL = 'https://www.producthunt.com/feed'

export async function fetchProductHunt(): Promise<NewsItem[]> {
  const xml = await fetchText(FEED_URL)
  return parseFeed(xml, 'producthunt', 30)
  // TODO(P3): when PRODUCTHUNT_API_TOKEN is configured, switch to the GraphQL
  // `posts(order: RANKING)` query to populate `score`/`info` with votesCount.
}
