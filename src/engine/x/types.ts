export interface XUser {
  id: string
  username: string
  name: string
  avatar?: string
  banner?: string
  bio?: string
  location?: string
  website?: string
  followers?: number
  following?: number
  posts?: number
  verified?: boolean
  protected?: boolean
  followedByMe?: boolean
}

export interface XPostPreview {
  id: string
  text: string
  user: XUser
  createdAt: number
  sensitive: boolean
  media: XMedia[]
}

export interface XMedia {
  kind: 'photo' | 'video' | 'gif'
  previewUrl: string
  playbackUrl?: string
  contentType?: string
  alt?: string
}

export interface XDmConversation {
  id: string
  participantIds: string[]
  lastText: string
  createdAt: number
  unread: boolean
}

export interface XDmMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: number
  mediaUrl?: string
}

export interface XDmPage {
  messages: XDmMessage[]
  cursor?: string
}

export interface XPoll {
  options: Array<{ label: string; votes: number }>
  totalVotes: number
  status?: string
}

export interface XLinkCard {
  title: string
  description?: string
  display: string
  url: string
}

export interface XPost {
  id: string
  text: string
  createdAt: number
  user: XUser
  replies: number
  reposts: number
  likes: number
  views: number
  liked: boolean
  reposted: boolean
  bookmarked: boolean
  sensitive: boolean
  replyToUsername?: string
  repostedBy?: XUser
  quote?: XPostPreview
  communityNote?: string
  urls: Array<{ display: string; expanded: string }>
  media: XMedia[]
  poll?: XPoll
  card?: XLinkCard
}

export interface XPage {
  posts: XPost[]
  cursor?: string
}

export interface XList {
  id: string
  name: string
  description?: string
  members?: number
  owner?: string
  kind: 'list' | 'community'
}

export interface XUserPage {
  users: XUser[]
  cursor?: string
}

export type XActivityKind = 'like' | 'reply' | 'repost' | 'follow' | 'mention' | 'quote' | 'other'

export interface XActivity {
  id: string
  kind: XActivityKind
  message: string
  actors: XUser[]
  post?: XPost
  createdAt: number
}

export interface XActivityPage {
  activities: XActivity[]
  cursor?: string
}

export interface XTrend {
  name: string
  volume?: number
  url?: string
}

export interface XMutationResult {
  ok: boolean
  id?: string
  message?: string
}
