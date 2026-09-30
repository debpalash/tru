const protocol = require('../../vendor/unbird/consts') as Record<string, any>

import type { DmConversation, DmMessage, NotifItem, NotifKind, Tweet, User } from '../../vendor/unbird/types'
import { parseBookmarksTimeline, parseHomeTimeline } from '../../vendor/unbird/parser/feeds'
import { parseFollowList, parseListOwnerships, parsePinnedLists } from '../../vendor/unbird/parser/lists'
import { parseNotificationsTimeline } from '../../vendor/unbird/parser/notifications'
import { parseGraphConversation, parseGraphSearch, parseGraphTimeline } from '../../vendor/unbird/parser/timelines'
import { parseTrends } from '../../vendor/unbird/parser/trends'
import { parseGraphUser } from '../../vendor/unbird/parser/user'
import { parseDmConversation, parseDmInbox } from '../../vendor/unbird/parser/dm'

import {
  adaptXActivity,
  adaptXBookmarks,
  adaptXConversation,
  adaptXHome,
  adaptXLists,
  adaptXSearch,
  adaptXTimeline,
  adaptXTrends,
  adaptXUser,
  adaptXUsers,
} from './adapter'
import { rememberXQueryId, resolveXQueryId, resolveXBearerToken } from './queryResolver'
import { getXSession, patchXSession } from './session'
import { privacyFetch } from '../privacy/transport'
import type { XActivityPage, XDmConversation, XDmPage, XList, XMutationResult, XPage, XTrend, XUser, XUserPage } from './types'

const GRAPH_BASE = 'https://x.com/i/api/graphql'
const REST_BASE = 'https://api.x.com'
const TIMEOUT_MS = 18_000

type UnknownRecord = Record<string, unknown>
type GraphOptions = {
  features?: string
  fieldToggles?: string
  search?: boolean
  mutation?: boolean
  mutationFeatures?: UnknownRecord
}

export class XClientError extends Error {
  constructor(public readonly code: 'login' | 'rate-limit' | 'request', message: string) {
    super(message)
    this.name = 'XClientError'
  }
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function variables(raw: string): UnknownRecord {
  try { return JSON.parse(raw) as UnknownRecord } catch { return {} }
}

function endpointParts(endpoint: string): { id: string; operation: string } {
  const slash = endpoint.indexOf('/')
  return slash < 0 ? { id: '', operation: endpoint } : { id: endpoint.slice(0, slash), operation: endpoint.slice(slash + 1) }
}

function transactionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 32)
}

async function headers(search = false): Promise<Record<string, string>> {
  const session = getXSession()
  if (!session) throw new XClientError('login', 'Connect X to load this surface.')
  return {
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    authorization: await resolveXBearerToken() ?? (() => { throw new XClientError('request', 'X authorization could not be resolved. Try again later.') })(),
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    cookie: [
      `auth_token=${session.authToken}`,
      `ct0=${session.ct0}`,
      `personalization_id="v1_${session.ct0.slice(0, 16)}=="`,
      `guest_id=v1%3A${Date.now()}`,
      'dnt=1',
    ].join('; '),
    dnt: '1',
    origin: 'https://x.com',
    pragma: 'no-cache',
    referer: 'https://x.com/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/133.0.0.0 Mobile Safari/537.36',
    'x-client-transaction-id': transactionId(),
    'x-csrf-token': session.ct0,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
  }
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await privacyFetch(url, { ...init, signal: controller.signal, credentials: 'omit' }, TIMEOUT_MS)
  } catch {
    throw new XClientError('request', controller.signal.aborted ? 'X took too long to respond.' : 'X could not be reached.')
  } finally {
    clearTimeout(timer)
  }
}

async function currentJarCsrf(): Promise<string | null> {
  try {
    const CookieManager = (require('@react-native-cookies/cookies') as { default: { get: (url: string, webkit?: boolean) => Promise<Record<string, { value?: string }>> } }).default
    const cookies = await CookieManager.get('https://x.com', true)
    return cookies.ct0?.value || null
  } catch {
    return null
  }
}

function payloadError(payload: unknown): XClientError | null {
  const raw = record(payload)?.errors
  const errors = Array.isArray(raw) ? raw : []
  if (!errors.length) return null
  const first = record(errors[0])
  const code = Number(first?.code)
  const detail = typeof first?.message === 'string' ? first.message : ''
  if ([32, 89, 353].includes(code)) return new XClientError('login', 'Your X session needs to be refreshed.')
  if (code === 88) return new XClientError('rate-limit', 'X is rate limiting this view. Try again shortly.')
  return new XClientError('request', detail ? `X: ${detail}` : 'X could not complete this request.')
}

async function graphRequest(endpoint: string, requestVariables: UnknownRecord, options: GraphOptions = {}): Promise<unknown> {
  let active = endpoint
  let queryHealed = false
  let csrfHealed = false
  let transientRetries = 0
  while (true) {
    const parts = endpointParts(active)
    const url = new URL(`${GRAPH_BASE}/${active}`)
    url.searchParams.set('variables', JSON.stringify(requestVariables))
    url.searchParams.set('features', options.features ?? protocol.gqlFeatures)
    if (options.fieldToggles) url.searchParams.set('fieldToggles', options.fieldToggles)
    const body = options.mutation ? JSON.stringify({
      variables: requestVariables,
      queryId: parts.id,
      ...(options.mutationFeatures ? { features: options.mutationFeatures } : {}),
    }) : undefined
    const response = await timedFetch(url.toString(), {
      method: options.mutation ? 'POST' : 'GET',
      headers: await headers(options.search),
      body,
    })

    if (response.status === 403 && !csrfHealed) {
      csrfHealed = true
      const fresh = await currentJarCsrf()
      if (fresh && fresh !== getXSession()?.ct0) {
        await patchXSession({ ct0: fresh })
        continue
      }
    }
    if (response.status === 404 && !queryHealed) {
      queryHealed = true
      const resolved = await resolveXQueryId(parts.operation)
      if (resolved && resolved !== parts.id) {
        rememberXQueryId(parts.operation, resolved)
        active = `${resolved}/${parts.operation}`
        continue
      }
    }
    if (response.status === 429) throw new XClientError('rate-limit', 'X is rate limiting this view. Try again shortly.')
    if (response.status === 401 || response.status === 403) throw new XClientError('login', 'Your X session expired. Reconnect X.')
    if (response.status >= 500 && transientRetries < 2) {
      transientRetries += 1
      await new Promise((resolve) => setTimeout(resolve, 450 * transientRetries))
      continue
    }
    const raw = await response.text()
    if (!response.ok) throw new XClientError('request', `X returned ${response.status}. Its web query may have changed.`)
    let payload: unknown
    try { payload = raw ? JSON.parse(raw) as unknown : null } catch { throw new XClientError('request', 'X returned an unreadable response.') }
    const error = payloadError(payload)
    if (error) throw error
    return payload
  }
}

async function resolvedRequest(operation: string, requestVariables: UnknownRecord, options: GraphOptions = {}): Promise<unknown> {
  const id = await resolveXQueryId(operation)
  if (!id) throw new XClientError('request', `X’s ${operation} query could not be resolved.`)
  return graphRequest(`${id}/${operation}`, requestVariables, options)
}

async function restRequest(endpoint: string, params: Array<[string, string]>, method: 'GET' | 'POST' = 'GET', body?: UnknownRecord): Promise<unknown> {
  const url = new URL(`${REST_BASE}/${endpoint}`)
  for (const [key, value] of params) url.searchParams.set(key, value)
  const response = await timedFetch(url.toString(), { method, headers: await headers(), body: body ? JSON.stringify(body) : undefined })
  if (response.status === 401 || response.status === 403) throw new XClientError('login', 'Your X session expired. Reconnect X.')
  if (response.status === 429) throw new XClientError('rate-limit', 'X is rate limiting this view. Try again shortly.')
  const raw = await response.text()
  if (!response.ok) throw new XClientError('request', `X returned ${response.status} for this account action.`)
  const payload = raw ? JSON.parse(raw) as unknown : null
  const error = payloadError(payload)
  if (error) throw error
  return payload
}

async function mutation(endpoint: string, requestVariables: UnknownRecord, features?: UnknownRecord): Promise<unknown> {
  return graphRequest(endpoint, requestVariables, { mutation: true, mutationFeatures: features })
}

function userResult(payload: unknown): unknown {
  const data = record(record(payload)?.data)
  const user = record(data?.user) ?? record(data?.user_result)
  return record(user?.result) ?? record(record(record(data?.viewer)?.user_results)?.result)
}

export async function validateXSession(): Promise<XUser> {
  const payload = await resolvedRequest('Viewer', { withCommunitiesMemberships: true })
  const result = userResult(payload)
  const user = result ? adaptXUser(parseGraphUser(result)) : null
  if (!user?.id || !user.username) throw new XClientError('login', 'X connected, but the account identity could not be verified.')
  await patchXSession({ username: user.username, userId: user.id })
  return user
}

export type XHomeFeed = 'for-you' | 'following'

export async function fetchXHome(cursor = '', feed: XHomeFeed = 'following'): Promise<XPage> {
  const endpoint = feed === 'for-you' ? protocol.graphHomeTimeline : protocol.graphHomeLatestTimeline
  const payload = await graphRequest(endpoint, variables(protocol.homeTimelineVars(cursor, 40)), {
    features: protocol.gqlNitterSearchFeatures,
    fieldToggles: protocol.mobileUserTweetsFeatures,
  })
  return adaptXHome(parseHomeTimeline(payload))
}

export async function searchX(query: string, cursor = '', product: 'Top' | 'Latest' | 'Photos' | 'Videos' = 'Latest'): Promise<XPage> {
  if (!query.trim()) return { posts: [] }
  const payload = await graphRequest(protocol.graphModernSearchTimeline, {
    rawQuery: query.trim(), count: 20, query_source: 'typedQuery', product, ...(cursor ? { cursor } : {}),
  }, { features: protocol.gqlModernSearchFeatures, fieldToggles: protocol.modernSearchFieldToggles, search: true })
  return adaptXSearch(parseGraphSearch<Tweet[]>(payload, cursor))
}

export async function searchXUsers(query: string, cursor = ''): Promise<XUserPage> {
  if (!query.trim()) return { users: [] }
  const payload = await graphRequest(protocol.graphModernSearchTimeline, {
    rawQuery: query.trim(), count: 20, query_source: 'typedQuery', product: 'People', ...(cursor ? { cursor } : {}),
  }, { features: protocol.gqlModernSearchFeatures, fieldToggles: protocol.modernSearchFieldToggles, search: true })
  const result = parseGraphSearch<User>(payload, cursor)
  return adaptXUsers(result.content, result.bottom)
}

export async function fetchXUser(username: string): Promise<XUser> {
  const clean = username.replace(/^@/, '').trim()
  const payload = await graphRequest(protocol.graphUser, { screen_name: clean, withSafetyModeUserFields: true }, { fieldToggles: protocol.userFieldToggles })
  const result = userResult(payload)
  if (!result) throw new XClientError('request', 'That X profile was not found.')
  const user = adaptXUser(parseGraphUser(result))
  if (!user.id) throw new XClientError('request', 'That X profile was not found.')
  return user
}

export async function fetchXUserById(userId: string): Promise<XUser> {
  if (!userId) throw new XClientError('request', 'That X account was not found.')
  const payload = await graphRequest(protocol.graphUserById, { userId, withSafetyModeUserFields: true }, { fieldToggles: protocol.userFieldToggles })
  const result = userResult(payload)
  if (!result) throw new XClientError('request', 'That X account was not found.')
  const user = adaptXUser(parseGraphUser(result))
  if (!user.id) throw new XClientError('request', 'That X account was not found.')
  return user
}

export async function fetchXUserPosts(userId: string, cursor = '', tab: 'posts' | 'replies' | 'media' | 'likes' = 'posts', username = ''): Promise<XPage> {
  if (tab === 'replies') return searchX(`from:${username}`, cursor)
  const endpoint = tab === 'likes' ? protocol.graphLikes : tab === 'media' ? protocol.graphUserMedia : protocol.graphUserTweets
  const requestVariables = tab === 'likes' ? {
    userId, count: 20, includePromotedContent: false, withClientEventToken: false,
    withBirdwatchNotes: false, withVoice: true, ...(cursor ? { cursor } : {}),
  } : variables(tab === 'media' ? protocol.userMediaVars(userId, cursor, 20) : protocol.userTweetsVars(userId, cursor))
  const payload = await graphRequest(endpoint, requestVariables, {
    features: protocol.gqlNitterSearchFeatures,
    fieldToggles: tab === 'posts' ? protocol.mobileUserTweetsFeatures : undefined,
  })
  return adaptXTimeline(parseGraphTimeline(payload, cursor))
}

export async function fetchXConnections(userId: string, kind: 'following' | 'followers', cursor = ''): Promise<XUserPage> {
  const payload = await graphRequest(kind === 'following' ? protocol.graphFollowing : protocol.graphFollowers, variables(protocol.followVars(userId, cursor, 50)), {
    features: protocol.followersFeatures, fieldToggles: protocol.userFieldToggles,
  })
  const parsed = parseFollowList(payload)
  return adaptXUsers(parsed.users, parsed.nextCursor)
}

export async function fetchXThread(id: string, cursor = ''): Promise<XPage> {
  if (!id) return { posts: [] }
  const payload = await graphRequest(protocol.graphTweetDetail, variables(protocol.tweetDetailVars(id, cursor)), { fieldToggles: protocol.tweetDetailFieldToggles })
  return adaptXConversation(parseGraphConversation(payload, id))
}

export async function fetchXBookmarks(cursor = ''): Promise<XPage> {
  const payload = await graphRequest(protocol.graphBookmarks, { count: 20, includePromotedContent: false, ...(cursor ? { cursor } : {}) }, { features: protocol.gqlNitterSearchFeatures })
  return adaptXBookmarks(parseBookmarksTimeline(payload))
}

async function accountLists(operation: 'ListOwnerships' | 'ListMemberships', userId: string): Promise<XList[]> {
  try {
    return adaptXLists(parseListOwnerships(await resolvedRequest(operation, { userId, count: 100 }, { features: protocol.pinnedTimelinesFeatures })))
  } catch {
    return []
  }
}

export async function fetchXLists(): Promise<XList[]> {
  let userId = getXSession()?.userId ?? ''
  if (!userId) {
    try { userId = (await validateXSession()).id } catch { /* pinned lists can still load */ }
  }
  const [pinnedPayload, owned, memberships] = await Promise.all([
    graphRequest(protocol.graphPinnedTimelines, {}, { features: protocol.pinnedTimelinesFeatures }).catch(() => null),
    userId ? accountLists('ListOwnerships', userId) : Promise.resolve([]),
    userId ? accountLists('ListMemberships', userId) : Promise.resolve([]),
  ])
  const pinned = pinnedPayload ? adaptXLists(parsePinnedLists(pinnedPayload)) : []
  return [...new Map([...owned, ...memberships, ...pinned].map((list) => [list.id, list])).values()]
}

export async function fetchXListPosts(id: string, kind: 'list' | 'community', cursor = ''): Promise<XPage> {
  if (kind === 'community') return { posts: [] }
  let endpoint = protocol.graphCommunityTweets
  let requestVariables: UnknownRecord = { communityId: id, count: 20, withCommunity: true, ...(cursor ? { cursor } : {}) }
  if (kind === 'list') {
    const current = await resolveXQueryId('ListLatestTweetsTimeline')
    endpoint = current ? `${current}/ListLatestTweetsTimeline` : protocol.graphListTweets
    requestVariables = { listId: id, count: 20, ...(cursor ? { cursor } : {}) }
  }
  const payload = await graphRequest(endpoint, requestVariables, { features: protocol.gqlNitterSearchFeatures, fieldToggles: protocol.mobileUserTweetsFeatures })
  return adaptXTimeline(parseGraphTimeline(payload, cursor))
}

export async function fetchXListMembers(id: string, cursor = ''): Promise<XUserPage> {
  if (!id) return { users: [] }
  const payload = await graphRequest(protocol.graphListMembers, variables(protocol.restIdVars(id, cursor, 20)))
  const result = parseGraphSearch<User>(payload, cursor)
  return adaptXUsers(result.content, result.bottom)
}

export async function fetchXActivity(cursor = ''): Promise<XActivityPage> {
  const payload = await graphRequest(protocol.graphNotifications, { timeline_type: 'All', count: 40, ...(cursor ? { cursor } : {}) }, { features: protocol.gqlNitterSearchFeatures })
  const parsed = parseNotificationsTimeline(payload)
  const items: NotifItem[] = parsed.notifications.map((item) => ({
    id: item.id,
    kind: (['like', 'reply', 'retweet', 'follow', 'mention', 'quote'].includes(item.type) ? item.type : 'other') as NotifKind,
    actors: item.users,
    tweet: item.tweet,
    text: item.message,
    time: item.time,
  }))
  return { activities: adaptXActivity(items), cursor: parsed.nextCursor || undefined }
}

export async function fetchXMentions(cursor = ''): Promise<XPage> {
  const username = getXSession()?.username
  if (!username) throw new XClientError('login', 'Refresh your X account once to load mentions.')
  return searchX(`to:${username} OR @${username}`, cursor)
}

export async function fetchXTrends(woeid = 1): Promise<XTrend[]> {
  return adaptXTrends(parseTrends(await restRequest(protocol.restTrendsPlace, [['id', String(woeid)]])))
}

function adaptDmConversation(item: DmConversation): XDmConversation {
  return { id: item.id, participantIds: item.participants, lastText: item.lastText, createdAt: item.time.getTime(), unread: item.unread }
}

function adaptDmMessage(item: DmMessage) {
  return { id: item.id, conversationId: item.conversationId, senderId: item.senderId, text: item.text, createdAt: item.time.getTime(), mediaUrl: item.mediaUrl }
}

export async function fetchXDmInbox(cursor = ''): Promise<{ conversations: XDmConversation[]; cursor?: string }> {
  const payload = await restRequest(protocol.restDmInbox, [
    ['nsfw_filtering_enabled', 'true'], ['include_conversation_info', 'true'],
    ['dm_secret_conversations_enabled', 'false'], ['krs_registration_enabled', 'true'],
    ['dm_users', 'true'], ['include_groups', 'true'], ['include_inbox_timelines', 'true'],
    ['supports_reactions', 'true'], ...(cursor ? [['max_id', cursor] as [string, string]] : []),
  ])
  const parsed = parseDmInbox(payload)
  return { conversations: parsed.conversations.map(adaptDmConversation), cursor: parsed.cursor || undefined }
}

export async function fetchXDmConversation(conversationId: string, cursor = ''): Promise<XDmPage> {
  if (!conversationId) return { messages: [] }
  const payload = await restRequest(protocol.restDmConversation(conversationId), [
    ['context', 'FETCH_DM_CONVERSATION'], ['include_conversation_info', 'true'],
    ['supports_reactions', 'true'], ...(cursor ? [['max_id', cursor] as [string, string]] : []),
  ])
  const parsed = parseDmConversation(payload)
  return { messages: parsed.messages.map(adaptDmMessage), cursor: parsed.cursor || undefined }
}

export async function sendXDm(conversationId: string, text: string): Promise<boolean> {
  const clean = text.trim()
  if (!conversationId || !clean) return false
  const payload = await restRequest(protocol.restDmNew, [], 'POST', {
    conversation_id: conversationId,
    recipient_ids: false,
    request_id: String(Date.now()),
    text: clean,
    cards_platform: 'Web-12',
    include_cards: 1,
    include_quote_count: true,
    dm_users: false,
  })
  return !record(payload)?.errors
}

export async function setXLike(id: string, active: boolean): Promise<boolean> {
  if (!id) return false
  await mutation(active ? protocol.graphFavoriteTweet : protocol.graphUnfavoriteTweet, { tweet_id: id })
  return true
}

export async function setXRepost(id: string, active: boolean): Promise<boolean> {
  if (!id) return false
  await mutation(active ? protocol.graphCreateRetweet : protocol.graphDeleteRetweet, active
    ? { tweet_id: id, dark_request: false }
    : { source_tweet_id: id, dark_request: false })
  return true
}

export async function setXBookmark(id: string, active: boolean): Promise<boolean> {
  if (!id) return false
  await mutation(active ? protocol.graphCreateBookmark : protocol.graphDeleteBookmark, { tweet_id: id })
  return true
}

export async function createXPost(text: string, options: { replyToId?: string; quoteId?: string; quoteUsername?: string } = {}): Promise<XMutationResult> {
  const clean = text.trim()
  if (!clean) return { ok: false, message: 'Write something before posting.' }
  const payload = await mutation(protocol.graphCreateTweet, {
    tweet_text: clean,
    dark_request: false,
    media: { media_entities: [], possibly_sensitive: false },
    semantic_annotation_ids: [],
    disallowed_reply_options: null,
    ...(options.replyToId ? { reply: { in_reply_to_tweet_id: options.replyToId, exclude_reply_user_ids: [] } } : {}),
    ...(options.quoteId ? { attachment_url: `https://twitter.com/${options.quoteUsername || 'i/web'}/status/${options.quoteId}` } : {}),
  }, JSON.parse(protocol.gqlFeatures) as UnknownRecord)
  const data = record(record(payload)?.data)
  const create = record(data?.create_tweet)
  const results = record(create?.tweet_results)
  const result = record(results?.result)
  const id = typeof result?.rest_id === 'string' ? result.rest_id : ''
  return id ? { ok: true, id } : { ok: false, message: 'X did not return the created post.' }
}

export async function deleteXPost(id: string): Promise<boolean> {
  if (!id) return false
  await mutation(protocol.graphDeleteTweet, { tweet_id: id, dark_request: false })
  return true
}

export async function setXFollow(userId: string, active: boolean): Promise<boolean> {
  if (!userId) return false
  await restRequest(active ? '1.1/friendships/create.json' : '1.1/friendships/destroy.json', [['user_id', userId]], 'POST')
  return true
}
