import { isGeneralAudienceSocialText } from '../news/safety'
import type {
  Conversation as UnbirdConversation,
  List as UnbirdList,
  NotifItem as UnbirdNotification,
  Profile as UnbirdProfile,
  Result as UnbirdResult,
  Trend as UnbirdTrend,
  Tweet as UnbirdTweet,
  User as UnbirdUser,
} from '../../vendor/unbird/types'

import type { XActivity, XLinkCard, XList, XMedia, XPage, XPoll, XPost, XPostPreview, XTrend, XUser, XUserPage } from './types'

export function adaptXUser(user: UnbirdUser): XUser {
  return {
    id: user.id,
    username: user.username,
    name: user.fullname || user.username,
    avatar: user.userPic || undefined,
    banner: user.banner || undefined,
    bio: user.bio || undefined,
    location: user.location || undefined,
    website: user.website || undefined,
    followers: user.followers,
    following: user.following,
    posts: user.tweets,
    verified: user.verifiedType !== 'None',
    protected: user.protected,
    followedByMe: user.isFollowing,
  }
}

function preview(tweet: UnbirdTweet): XPostPreview | undefined {
  const post = adaptXPost(tweet)
  return post ? {
    id: post.id,
    text: post.text,
    user: post.user,
    createdAt: post.createdAt,
    sensitive: post.sensitive,
    media: post.media,
  } : undefined
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
}

function adaptMedia(tweet: UnbirdTweet): XMedia[] {
  const output: XMedia[] = []
  for (const item of tweet.media.slice(0, 4)) {
    if ('photo' in item && /^https:\/\//i.test(item.photo.url)) {
      output.push({ kind: 'photo', previewUrl: item.photo.url, alt: item.photo.altText || undefined })
      continue
    }
    if ('video' in item && /^https:\/\//i.test(item.video.thumb)) {
      const playable = [...item.video.variants]
        .filter((variant) => variant.contentType === 'video/mp4' && /^https:\/\//i.test(variant.url))
        .sort((a, b) => (b.bitrate || b.resolution) - (a.bitrate || a.resolution))[0]
      const playbackUrl = playable?.url || (/^https:\/\//i.test(item.video.url) ? item.video.url : undefined)
      output.push({
        kind: 'video',
        previewUrl: item.video.thumb,
        playbackUrl,
        contentType: playable?.contentType || item.video.playbackType,
        alt: item.video.title || item.video.description || undefined,
      })
      continue
    }
    if ('gif' in item && /^https:\/\//i.test(item.gif.thumb)) {
      output.push({
        kind: 'gif',
        previewUrl: item.gif.thumb,
        playbackUrl: /^https:\/\//i.test(item.gif.url) ? item.gif.url : undefined,
        contentType: 'video/mp4',
        alt: item.gif.altText || undefined,
      })
    }
  }
  return output
}

export function adaptXPost(input: UnbirdTweet): XPost | null {
  const source = input.retweet?.id ? input.retweet : input
  if (!source.id || !source.available) return null
  const user = adaptXUser(source.user)
  const text = decodeEntities(source.text).trim()
  if (!isGeneralAudienceSocialText(`${text} ${user.username} ${user.name} ${user.bio ?? ''}`)) return null
  const media = adaptMedia(source)
  const quote = source.quote?.id ? preview(source.quote) : undefined
  const card: XLinkCard | undefined = source.card?.url && /^https:\/\//i.test(source.card.url) ? {
    title: decodeEntities(source.card.title || source.card.dest || source.card.url),
    description: decodeEntities(source.card.text || '').trim() || undefined,
    display: source.card.dest || source.card.url.replace(/^https?:\/\//i, ''),
    url: source.card.url,
  } : undefined
  const poll: XPoll | undefined = source.poll?.options.length ? {
    options: source.poll.options.map((label, index) => ({ label: decodeEntities(label), votes: source.poll?.values[index] ?? 0 })),
    totalVotes: source.poll.votes,
    status: source.poll.status || undefined,
  } : undefined
  if (!user.id || !user.username || (!text && !media.length && !card && !poll)) return null
  const urls: Array<{ display: string; expanded: string }> = []
  if (source.card?.url && /^https?:\/\//i.test(source.card.url)) {
    urls.push({ display: source.card.dest || source.card.url.replace(/^https?:\/\//i, ''), expanded: source.card.url })
  }
  return {
    id: source.id,
    text,
    createdAt: source.time instanceof Date ? source.time.getTime() : Date.now(),
    user,
    replies: source.stats.replies,
    reposts: source.stats.retweets,
    likes: source.stats.likes,
    views: source.stats.views,
    liked: Boolean(source.liked),
    reposted: Boolean(source.retweeted),
    bookmarked: Boolean(source.bookmarked),
    sensitive: Boolean(input.sensitive || source.sensitive || source.quote?.sensitive),
    replyToUsername: source.reply[0] || undefined,
    repostedBy: input.retweet?.id ? adaptXUser(input.user) : undefined,
    quote,
    communityNote: source.note || undefined,
    urls,
    media,
    poll,
    card,
  }
}

function page(tweets: readonly UnbirdTweet[], cursor = ''): XPage {
  const posts: XPost[] = []
  const seen = new Set<string>()
  for (const tweet of tweets) {
    const post = adaptXPost(tweet)
    if (post && !seen.has(post.id)) {
      seen.add(post.id)
      posts.push(post)
    }
  }
  return { posts, cursor: cursor || undefined }
}

export function adaptXTimeline(profile: UnbirdProfile): XPage {
  return page(profile.tweets.content.flat(), profile.tweets.bottom)
}

export function adaptXHome(result: { tweets: UnbirdTweet[]; nextCursor: string }): XPage {
  return page(result.tweets, result.nextCursor)
}

export function adaptXBookmarks(result: { tweets: UnbirdTweet[]; nextCursor: string }): XPage {
  return page(result.tweets, result.nextCursor)
}

export function adaptXSearch(result: UnbirdResult<UnbirdTweet[]>): XPage {
  return page(result.content.flat(), result.bottom)
}

export function adaptXConversation(conversation: UnbirdConversation): XPage {
  const replies = conversation.replies.content.flatMap((chain) => chain.content)
  return page([
    conversation.tweet,
    ...conversation.before.content,
    ...conversation.after.content,
    ...replies,
  ], conversation.replies.bottom || conversation.after.cursor)
}

export function adaptXUsers(users: readonly UnbirdUser[], cursor = ''): XUserPage {
  const output: XUser[] = []
  const seen = new Set<string>()
  for (const item of users) {
    const user = adaptXUser(item)
    if (!user.id || !user.username || seen.has(user.id)) continue
    seen.add(user.id)
    output.push(user)
  }
  return { users: output, cursor: cursor || undefined }
}

export function adaptXLists(lists: readonly UnbirdList[]): XList[] {
  return lists.flatMap((list) => {
    if (!list.id || !list.name || list.kind === 'community' || !isGeneralAudienceSocialText(`${list.name} ${list.description ?? ''}`)) return []
    return [{
      id: list.id,
      name: list.name,
      description: list.description || undefined,
      members: list.members,
      owner: list.username || undefined,
      kind: list.kind ?? 'list',
    }]
  })
}

export function adaptXActivity(items: readonly UnbirdNotification[]): XActivity[] {
  return items.flatMap((item) => {
    const actors = adaptXUsers(item.actors).users
    const post = item.tweet ? adaptXPost(item.tweet) ?? undefined : undefined
    return [{
      id: item.id,
      kind: item.kind === 'retweet' ? 'repost' : item.kind,
      message: item.text,
      actors,
      post,
      createdAt: item.time instanceof Date ? item.time.getTime() : Date.now(),
    }]
  })
}

export function adaptXTrends(trends: readonly UnbirdTrend[]): XTrend[] {
  return trends.map((trend) => ({ name: trend.name, volume: trend.tweetVolume, url: trend.url }))
}
