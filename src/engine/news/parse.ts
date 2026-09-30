// Tiny, dependency-free parsing helpers shared by the news sources: HTML-entity
// decoding, tag stripping, and a regex RSS/Atom feed reader. No `cheerio` /
// `htmlparser2` in the dep set, matching the regex-scrape approach the app's existing
// web sources already use. Good enough for the small, well-formed feeds we read.

import type { NewsItem } from './types'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&#x2f;': '/',
  '&#47;': '/',
  '&nbsp;': ' ',
  '&mdash;': ' - ',
  '&ndash;': '–',
  '&hellip;': '…',
}

/** Decode named + numeric HTML entities (handles double-encoded `&amp;amp;`). */
export function decodeEntities(input: string): string {
  return input.replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, (m) => {
    const named = ENTITIES[m.toLowerCase()]
    if (named) return named
    const hex = /^&#x([0-9a-f]+);$/i.exec(m)
    if (hex) return safeCodePoint(parseInt(hex[1], 16))
    const dec = /^&#([0-9]+);$/.exec(m)
    if (dec) return safeCodePoint(parseInt(dec[1], 10))
    return m
  })
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** Strip tags + collapse whitespace + decode entities → clean plain text. */
export function cleanText(html: string): string {
  // Some feeds entity-encode their whole HTML fragment (`&lt;p&gt;...`). Decode
  // before stripping or those tags become visible text in the native row.
  const decoded = decodeEntities(decodeEntities(html))
  const stripped = decoded.replace(/<[^>]+>/g, ' ')
  const collapsed = stripped.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
  return decodeEntities(collapsed)
}

function unwrapCdata(s: string): string {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s)
  return m ? m[1] : s
}

/** First `<tag>…</tag>` inner text within `block` (CDATA-aware), or undefined. */
function tagText(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
  const m = re.exec(block)
  if (!m) return undefined
  return unwrapCdata(m[1]).trim()
}

// A link can be RSS (`<link>url</link>`) or Atom (`<link rel="alternate" href="…"/>`
// Prefer alternate, then fall back to the first href).
function extractLink(block: string): string | undefined {
  const rss = tagText(block, 'link')
  if (rss && /^https?:/i.test(rss)) return rss
  const alt = /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i.exec(block)
  if (alt) return alt[1]
  const any = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(block)
  return any ? any[1] : undefined
}

/**
 * Parse an RSS 2.0 or Atom feed into NewsItem[]. Reads `<item>` (RSS) and
 * `<entry>` (Atom) blocks; pulls title, link, description/summary, and a date
 * (pubDate / published / updated / dc:date). `id` is `${sourceId}:${link}`.
 */
export function parseFeed(xml: string, sourceId: string, limit = 30): NewsItem[] {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []
  const out: NewsItem[] = []
  // Two `<item>`/`<entry>` blocks sharing a `<link>` would otherwise produce an
  // identical `${sourceId}:${link}` id and duplicate FlashList keys. Track links
  // we've already emitted and skip repeats (only counting ones actually pushed,
  // so an earlier duplicate that got filtered out for other reasons doesn't
  // wrongly suppress a later, valid one).
  const seenLinks = new Set<string>()
  for (let i = 0; i < blocks.length && out.length < limit; i++) {
    const b = blocks[i]
    const rawTitle = tagText(b, 'title')
    const rawLink = extractLink(b)
    if (!rawTitle || !rawLink) continue
    // Feed URLs entity-encode `&` as `&amp;`; decode so Linking gets a real URL.
    const link = decodeEntities(rawLink)
    if (seenLinks.has(link)) continue
    const title = cleanText(rawTitle)
    if (!title) continue
    const desc =
      tagText(b, 'description') ?? tagText(b, 'summary') ?? tagText(b, 'content')
    const dateStr =
      tagText(b, 'pubDate') ??
      tagText(b, 'published') ??
      tagText(b, 'updated') ??
      tagText(b, 'dc:date')
    const parsed = dateStr ? Date.parse(dateStr) : NaN
    seenLinks.add(link)
    out.push({
      id: `${sourceId}:${link}`,
      sourceId,
      title,
      url: link,
      hover: desc ? cleanText(desc).slice(0, 200) : undefined,
      time: Number.isNaN(parsed) ? undefined : parsed,
      rank: out.length + 1,
    })
  }
  return out
}
