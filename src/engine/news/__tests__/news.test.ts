import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseFeed } from '../parse'
import { NEWS_SOURCES, activeCategories, sourcesFor } from '../registry'
import { setLocationCountry } from '../../location'
import { isGeneralAudienceNews } from '../safety'

describe('Tru news core', () => {
  it('ships only the intended mainstream source set', () => {
    assert.deepEqual(
      NEWS_SOURCES.map((source) => source.id),
      [
        'hackernews', 'github', 'producthunt', 'theverge', 'arstechnica', 'bbc',
        'thehindu', 'ndtv-india', 'indianexpress', 'guardian', 'npr', 'bbc-uk',
        'cbc-canada', 'sbs-australia', 'rnz-new-zealand', 'cna-singapore', 'scmp',
        'rappler', 'nhk-japan', 'france24', 'dw-germany', 'lemonde-france',
        'aljazeera', 'the-national', 'daily-maverick', 'rfi-english',
        'buenos-aires-herald', 'mexico-news-daily',
      ],
    )
    const countries = new Set(NEWS_SOURCES.flatMap((source) => source.coverage?.countries ?? []))
    const regions = new Set(NEWS_SOURCES.flatMap((source) => source.coverage?.regions ?? []))
    for (const country of ['IN', 'US', 'GB', 'CA', 'AU', 'NZ', 'SG', 'PH', 'JP', 'DE', 'FR', 'AE', 'ZA', 'AR', 'MX']) assert(countries.has(country))
    for (const region of ['africa', 'asia', 'europe', 'latin-america', 'middle-east'] as const) assert(regions.has(region))
    assert.deepEqual(activeCategories(), ['all', 'tech', 'dev', 'world'])
  })

  it('parses, cleans and de-duplicates RSS entries', () => {
    const xml = `
      <rss><channel>
        <item><title>One &amp; Two</title><link>https://example.com/a?x=1&amp;y=2</link><description><![CDATA[<b>Summary</b> text]]></description><pubDate>Wed, 26 Aug 2026 10:00:00 GMT</pubDate></item>
        <item><title>Duplicate</title><link>https://example.com/a?x=1&amp;y=2</link></item>
      </channel></rss>`
    const items = parseFeed(xml, 'test')
    assert.equal(items.length, 1)
    assert.equal(items[0].title, 'One & Two')
    assert.equal(items[0].url, 'https://example.com/a?x=1&y=2')
    assert.equal(items[0].hover, 'Summary text')
  })

  it('curates national and regional feeds from the on-device country', async () => {
    try {
      await setLocationCountry('CA')
      const canada = new Set(sourcesFor('world').map((source) => source.id))
      assert(canada.has('cbc-canada'))
      assert(!canada.has('thehindu'))

      await setLocationCountry('IN')
      const india = new Set(sourcesFor('world').map((source) => source.id))
      assert(india.has('thehindu'))
      assert(india.has('cna-singapore'))
      assert(!india.has('cbc-canada'))
    } finally {
      await setLocationCountry(null)
    }
  })

  it('removes tags even when a feed entity-encodes the whole fragment', () => {
    const xml = '<rss><channel><item><title>Launch</title><link>https://example.com/launch</link><description>&amp;lt;p&amp;gt;A clean &amp;lt;b&amp;gt;summary&amp;lt;/b&amp;gt;.&amp;lt;/p&amp;gt;</description></item></channel></rss>'
    assert.equal(parseFeed(xml, 'test')[0].hover, 'A clean summary.')
  })

  it('keeps explicit material out of every downstream surface', () => {
    assert.equal(isGeneralAudienceNews({ id: 'safe', sourceId: 'test', title: 'A normal technology update', url: 'https://example.com/safe' }), true)
    assert.equal(isGeneralAudienceNews({ id: 'blocked', sourceId: 'test', title: 'A report about pornographic training data', url: 'https://example.com/blocked' }), false)
  })
})
