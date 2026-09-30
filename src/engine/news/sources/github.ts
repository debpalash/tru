// GitHub Trending source, HTML-scraped from github.com/trending (no API/RSS for
// trending). The markup is stable: each repo is an `<article class="Box-row">`
// with an `<h2 class="h3 lh-condensed"><a href="/owner/repo">`, a description
// `<p>`, a total-stars `…/stargazers` link, and a "N stars today" span. Parsed
// with regex (no DOM parser in the dep set); fails soft to [] if markup shifts.

import { cleanText } from '../parse'
import { fetchText } from '../http'
import type { NewsItem } from '../types'

const TRENDING_URL = 'https://github.com/trending'

export async function fetchGithubTrending(): Promise<NewsItem[]> {
  const html = await fetchText(TRENDING_URL)
  const articles = html.match(/<article class="Box-row">[\s\S]*?<\/article>/g) ?? []
  const out: NewsItem[] = []

  articles.forEach((a, i) => {
    const h2 = /<h2 class="h3 lh-condensed">([\s\S]*?)<\/h2>/.exec(a)
    if (!h2) return
    const hrefM = /href="(\/[^"]+)"/.exec(h2[1])
    if (!hrefM) return
    const path = hrefM[1] // "/owner/repo"
    // Title is "owner / repo" in the markup; normalize the spaced slash.
    const title = cleanText(h2[1]).replace(/\s*\/\s*/, '/')
    const url = `https://github.com${path}`

    const descM = /<p class="col-9[^"]*">([\s\S]*?)<\/p>/.exec(a)
    const desc = descM ? cleanText(descM[1]) : undefined

    const starM = /href="[^"]*\/stargazers"[^>]*>([\s\S]*?)<\/a>/.exec(a)
    const starsText = starM ? cleanText(starM[1]) : ''
    const stars = starsText ? parseInt(starsText.replace(/[^\d]/g, ''), 10) : undefined

    const todayM = /([\d,]+)\s*stars today/.exec(a)
    const info = todayM
      ? `★ ${todayM[1]} today`
      : starsText
        ? `★ ${starsText}`
        : undefined

    const langM = /itemprop="programmingLanguage">([^<]+)<\/span>/.exec(a)
    const lang = langM ? langM[1].trim() : undefined

    out.push({
      id: `github:${path}`,
      sourceId: 'github',
      title,
      url,
      hover: [lang, desc].filter(Boolean).join(' · ') || undefined,
      score: Number.isNaN(stars as number) ? undefined : stars,
      info,
      rank: i + 1,
    })
  })

  return out
}
