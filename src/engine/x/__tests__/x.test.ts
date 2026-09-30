import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { adaptXHome, adaptXLists, adaptXPost } from '../adapter'
import { falconsaiScore, freepikScore, giacomoScore, isTrustedXMediaUrl, xMediaPreviewUrl } from '../mediaSafety'
import { extractXBundleUrls, extractXQueryId } from '../queryResolver'

const USER = {
  id: '42', username: 'reporter', fullname: 'Reliable Reporter', location: '', website: '', bio: 'Technology reporter',
  userPic: 'https://pbs.twimg.com/avatar.jpg', banner: '', pinnedTweet: 0, following: 20, followers: 400,
  tweets: 100, likes: 10, media: 0, verifiedType: 'Blue', protected: false, suspended: false, joinDate: new Date(0), isFollowing: true,
}

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: '100', threadId: '100', replyId: '', user: USER, text: 'A concise technology update', time: new Date('2026-08-28T09:00:00Z'),
    reply: [], pinned: false, hasThread: false, available: true, tombstone: '', location: '', source: '',
    stats: { replies: 2, retweets: 3, likes: 9, views: 120 }, mediaTags: [], media: [], history: [], note: '', isAd: false, isAI: false,
    liked: true, retweeted: false, bookmarked: true, ...overrides,
  } as any
}

describe('Tru X integration', () => {
  it('preserves the signed-in account feed and carries X sensitivity metadata to the media gate', () => {
    const adapted = adaptXPost(post())
    assert.equal(adapted?.id, '100')
    assert.equal(adapted?.liked, true)
    assert.equal(adapted?.bookmarked, true)
    assert.equal(adaptXPost(post({ sensitive: true }))?.sensitive, true)
    assert.equal(adaptXPost(post({ text: 'Explicit sexual content' })), null)
    assert.equal(adaptXPost(post({ text: 'Explicit account text' }))?.text, 'Explicit account text')
  })

  it('preserves parsed X media without letting arbitrary hosts enter the safety scanner', () => {
    const adapted = adaptXPost(post({ media: [{ kind: 'photoMedia', photo: { url: 'https://pbs.twimg.com/media/example.jpg', altText: 'Launch photo' } }] }))
    assert.deepEqual(adapted?.media, [{ kind: 'photo', previewUrl: 'https://pbs.twimg.com/media/example.jpg', alt: 'Launch photo' }])
    assert.equal(isTrustedXMediaUrl('https://pbs.twimg.com/media/example.jpg'), true)
    assert.equal(isTrustedXMediaUrl('https://example.com/image.jpg'), false)
    assert.equal(xMediaPreviewUrl('https://pbs.twimg.com/media/example.jpg?format=jpg&name=large'), 'https://pbs.twimg.com/media/example.jpg?format=jpg&name=small')
    assert.equal(xMediaPreviewUrl('https://pbs.twimg.com/profile_images/42/avatar.jpg'), 'https://pbs.twimg.com/profile_images/42/avatar.jpg')
  })

  it('uses strict multi-model media scores', () => {
    assert.equal(falconsaiScore([{ label: 'nsfw', score: 0.91 }, { label: 'normal', score: 0.09 }]), 0.91)
    assert.equal(freepikScore([{ label: 'medium', score: 0.45 }]), 0.58)
    assert.ok((giacomoScore([{ label: 'sexy', score: 0.21 }]) ?? 0) >= 0.72)
  })

  it('keeps account lists while excluding unclassified communities', () => {
    const list = { id: '1', name: 'Technology', description: 'Software builders', members: 5, username: 'owner', kind: 'list' }
    assert.equal(adaptXLists([list as any]).length, 1)
    assert.equal(adaptXLists([{ ...list, kind: 'community' } as any]).length, 0)
  })

  it('maps reposts to the original actionable post and de-duplicates pages', () => {
    const original = post({ id: '200' })
    const repost = post({ id: '201', user: { ...USER, id: '7', username: 'reader', fullname: 'Reader' }, retweet: original })
    const adapted = adaptXPost(repost)
    assert.equal(adapted?.id, '200')
    assert.equal(adapted?.repostedBy?.username, 'reader')
    assert.deepEqual(adaptXHome({ tweets: [repost, original], nextCursor: 'next' }).posts.map((item) => item.id), ['200'])
    assert.equal(adaptXHome({ tweets: [original], nextCursor: 'next' }).cursor, 'next')
  })

  it('extracts only X-owned responsive bundles and rotating query ids', () => {
    const html = '<script src="https://abs.twimg.com/responsive-web/client-web/main.123.js"></script><script src="https://evil.example/responsive-web/bad.js"></script>'
    assert.deepEqual(extractXBundleUrls(html), ['https://abs.twimg.com/responsive-web/client-web/main.123.js'])
    assert.equal(extractXQueryId('{queryId:"abcDEF_1234567890",operationName:"Viewer",operationType:"query"}', 'Viewer'), 'abcDEF_1234567890')
  })
})
