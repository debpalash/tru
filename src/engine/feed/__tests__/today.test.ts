import { connectService, disconnectService } from '../../service/connection'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { NewsItem } from '../../news/types'
import {
  buildTodayFeed,
  collapseCorroboratedFeed,
  filterTodayFeed,
  pickBriefItems,
  rankSmartFeed,
} from '../today'
import { assessFeedEvidence, headlineSimilarity, isVerifiedPublisherUrl } from '../evidence'
import { getSource, getTrustedPublisher, trustedPublisherForUrl } from '../../news/registry'
import {
  getFirecrawlUsage,
  normalizeFirecrawlLedger,
  searchTrustedWeb,
} from '../../web/firecrawl'
import {
  buildFeedAgentMessages,
  citedSourceNumbers,
  formatAgentText,
  presentAgentText,
} from '../../agent/feedAgent'

const ITEMS: NewsItem[] = [
  { id: 'hackernews:1', sourceId: 'hackernews', title: 'HN story', url: 'https://example.com/hn' },
  { id: 'bbc:1', sourceId: 'bbc', title: 'World story', url: 'https://example.com/world' },
  { id: 'github:1', sourceId: 'github', title: 'Developer story', url: 'https://example.com/dev' },
]

describe('unified Today feed', () => {
  it('adapts real news sources into typed feed items', () => {
    const feed = buildTodayFeed(ITEMS)
    assert.deepEqual(feed.map((item) => item.kind), ['hn', 'world', 'news'])
    assert.deepEqual(filterTodayFeed(feed, 'news').map((item) => item.id), ['hackernews:1', 'github:1'])
    assert.deepEqual(filterTodayFeed(feed, 'world').map((item) => item.id), ['bbc:1'])
  })

  it('builds a varied compact brief', () => {
    assert.deepEqual(pickBriefItems(buildTodayFeed(ITEMS)).map((item) => item.sourceId), [
      'hackernews',
      'bbc',
      'github',
    ])
  })

  it('grounds agent prompts in numbered source context', () => {
    const built = buildFeedAgentMessages('What changed?', ITEMS)
    assert.equal(built.sources.length, 3)
    assert.match(built.messages[0]?.content ?? '', /Never invent a source/)
    assert.match(built.messages[1]?.content ?? '', /\[1\] HN story/)
    assert.match(built.messages[1]?.content ?? '', /Question: What changed\?/)
  })

  it('presents provider markdown as clean mobile text', () => {
    assert.equal(
      formatAgentText('### Confirmed\n\n**Technology**\n* Change [1]'),
      'Confirmed\n\nTechnology\n• Change [1]',
    )
    assert.equal(
      formatAgentText('Confirmed \u2014 the source supports this [1].'),
      'Confirmed: the source supports this [1].',
    )
    assert.deepEqual(presentAgentText('Confirmed facts\n\n• First change [2]\n• Second change [5]'), {
      heading: 'Confirmed facts',
      highlights: ['First change [2]', 'Second change [5]'],
      prose: '',
    })
    assert.deepEqual(
      citedSourceNumbers('Change [4, 13], corroborated by [6,15], [16], and [4].'),
      [4, 13, 6, 15, 16],
    )
    assert.deepEqual(
      presentAgentText(formatAgentText('1. First change [1]\n2) Second change [2]')).highlights,
      ['First change [1]', 'Second change [2]'],
    )
  })

  it('scores headline evidence only when publisher links and independent reports verify', () => {
    const reports: NewsItem[] = [
      {
        id: 'bbc:flood', sourceId: 'bbc',
        title: 'Collapsed glacier likely caused devastating Nepal-Tibet floods, scientists say',
        url: 'https://www.bbc.com/news/articles/flood', time: Date.now(),
      },
      {
        id: 'thehindu:flood', sourceId: 'thehindu',
        title: 'Nepal-Tibet floods linked to collapsed glacier as hundreds remain missing',
        url: 'https://www.thehindu.com/news/national/flood/article.test', time: Date.now(),
      },
      {
        id: 'guardian:flood', sourceId: 'guardian',
        title: 'Collapsed glacier linked to deadly floods on Nepal-Tibet border',
        url: 'https://www.theguardian.com/world/2026/aug/28/flood', time: Date.now(),
      },
    ]
    const evidence = assessFeedEvidence(reports).get('bbc:flood')
    assert.ok(headlineSimilarity(reports[0].title, reports[1].title) >= 0.66)
    assert.equal(evidence?.status, 'strong')
    assert.equal(evidence?.links.length, 3)
    assert.ok((evidence?.score ?? 0) >= 85)
    assert.equal(collapseCorroboratedFeed(rankSmartFeed(buildTodayFeed(reports))).length, 1)
  })

  it('caps single-source claims and rejects lookalike URLs', () => {
    const bbc = getSource('bbc')!
    assert.equal(isVerifiedPublisherUrl('https://www.bbc.com/news/story', bbc), true)
    assert.equal(isVerifiedPublisherUrl('https://bbc.com.evil.example/news/story', bbc), false)
    const [item] = buildTodayFeed([{
      id: 'bbc:solo', sourceId: 'bbc', title: 'A unique report with no corroboration',
      url: 'https://www.bbc.com/news/articles/solo', time: Date.now(),
    }])
    assert.equal(item.evidence.status, 'single-source')
    assert.ok(item.evidence.score <= 60)
    assert.equal(
      headlineSimilarity(
        'A collapsed glacier caused deadly Nepal-Tibet floods and left hundreds missing',
        'Expert calls flash floods a warning for Indo-Nepal ties',
      ),
      0,
    )
    assert.equal(
      headlineSimilarity(
        'Floods kill nearly 400 people with 90 tourists missing',
        'Flash flood kills at least 356 with nearly 1,400 missing',
      ),
      0,
    )
  })

  it('accepts only pinned web publishers as external corroboration', () => {
    const target: NewsItem = {
      id: 'bbc:mission', sourceId: 'bbc',
      title: 'NASA launches climate satellite to study changing oceans',
      url: 'https://www.bbc.com/news/articles/mission', time: Date.now(),
    }
    const reuters: NewsItem = {
      id: 'firecrawl:mission', sourceId: 'reuters',
      title: 'NASA launches climate satellite to study changing oceans',
      url: 'https://www.reuters.com/science/nasa-launches-climate-satellite-2026-08-28/',
    }
    const [card] = buildTodayFeed([target], [target, reuters])
    assert.equal(card.evidence.status, 'supported')
    assert.equal(card.evidence.independentPublishers, 2)
    assert.equal(trustedPublisherForUrl(reuters.url)?.id, 'reuters')
    assert.equal(trustedPublisherForUrl('https://reuters.com.evil.example/story'), undefined)
    assert.equal(isVerifiedPublisherUrl(reuters.url, getTrustedPublisher('reuters')!), true)
  })

  it('resets the local Firecrawl guardrail at UTC period boundaries', () => {
    const now = Date.parse('2026-08-28T12:00:00Z')
    assert.deepEqual(
      normalizeFirecrawlLedger({ day: '2026-08-27', dayCredits: 12, month: '2026-08', monthCredits: 80 }, now),
      { day: '2026-08-28', dayCredits: 0, month: '2026-08', monthCredits: 80 },
    )
  })

  it('makes bounded SafeSearch requests and admits only pinned domains', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ providers: ['gemini'], media: true, web: true })) as unknown as typeof fetch
    await connectService('https://service.example', 'a'.repeat(43))
    let requestBody: Record<string, unknown> = {}
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({
        success: true,
        data: {
          web: [
            { title: 'Verified report', url: 'https://www.reuters.com/world/verified-report/', position: 1 },
            { title: 'Unpinned copy', url: 'https://example.com/copied-report/', position: 2 },
          ],
        },
      }), { status: 200 })
    }) as unknown as typeof fetch
    try {
      const result = await searchTrustedWeb('verified report', { limit: 8, recency: 'week' })
      assert.equal(requestBody.safe, true)
      assert.equal(requestBody.tbs, 'qdr:w')
      assert.equal(requestBody.limit, 8)
      assert.equal(result.results.length, 1)
      assert.equal(result.results[0]?.publisherId, 'reuters')
    } finally {
      globalThis.fetch = originalFetch
      await disconnectService()
    }
  })

  it('refunds the local reservation when the service rejects a request', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ providers: ['gemini'], media: true, web: true })) as unknown as typeof fetch
    await connectService('https://service.example', 'a'.repeat(43))
    const before = await getFirecrawlUsage()
    globalThis.fetch = (async () => new Response(JSON.stringify({
      success: false,
      error: 'Unfortunately, your IP address looks suspicious, so Firecrawl cannot be used without an API key.',
    }), { status: 403 })) as unknown as typeof fetch
    try {
      await assert.rejects(() => searchTrustedWeb('network rejection'))
      const after = await getFirecrawlUsage()
      assert.equal(after.dayCredits, before.dayCredits)
      assert.equal(after.monthCredits, before.monthCredits)
    } finally {
      globalThis.fetch = originalFetch
      await disconnectService()
    }
  })
})
