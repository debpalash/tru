// SPDX-License-Identifier: AGPL-3.0-only
// X-only types adapted from Unbird; unrelated adapters omitted.
export enum QueryKind {
  Posts = "posts",
  Replies = "replies",
  Media = "media",
  Users = "users",
  Tweets = "tweets",
  UserList = "userList",
}

export enum VerifiedType {
  None = "None",
  Blue = "Blue",
  Business = "Business",
  Government = "Government",
  Subscriber = "Subscriber",
}

export enum VideoType {
  M3u8 = "application/x-mpegURL",
  Mp4 = "video/mp4",
  Vmap = "video/vmap",
}

export enum MediaKind {
  Photo = "photoMedia",
  Video = "videoMedia",
  Gif = "gifMedia",
}

export enum CardKind {
  Amplify = "amplify",
  App = "app",
  AppPlayer = "appplayer",
  Player = "player",
  Summary = "summary",
  SummaryLarge = "summary_large_image",
  PromoWebsite = "promo_website",
  PromoVideo = "promo_video_website",
  PromoVideoConvo = "promo_video_convo",
  PromoImageConvo = "promo_image_convo",
  PromoImageApp = "promo_image_app",
  StoreLink = "direct_store_link_app",
  LiveEvent = "live_event",
  Broadcast = "broadcast",
  Periscope = "periscope_broadcast",
  Unified = "unified_card",
  Moment = "moment",
  MessageMe = "message_me",
  VideoDirectMessage = "video_direct_message",
  ImageDirectMessage = "image_direct_message",
  AudioSpace = "audiospace",
  NewsletterPublication = "newsletter_publication",
  JobDetails = "job_details",
  Hidden = "hidden",
  Unknown = "unknown",
}

export interface User {
  id: string;
  username: string;
  fullname: string;
  location: string;
  website: string;
  bio: string;
  userPic: string;
  banner: string;
  pinnedTweet: number;
  following: number;
  followers: number;
  tweets: number;
  likes: number;
  media: number;
  verifiedType: VerifiedType;
  protected: boolean;
  suspended: boolean;
  joinDate: Date;
  isFollowing?: boolean;
  /** Only ever set when X's relationship_perspectives payload carries it. */
  isMuted?: boolean;
  isBlocked?: boolean;
  /** First pinned_tweet_ids_str entry (the official profile-pinned post). */
  pinnedTweetId?: string;
}

export interface VideoVariant {
  contentType: VideoType;
  url: string;
  bitrate: number;
  resolution: number;
}

export interface Video {
  /**
   * A continuous broadcast with no end: a cam room, not a clip.
   *
   * Not inferable from `playbackType` — plenty of HLS here is VOD — and not
   * from `durationMs: 0` either, which several adapters set simply because they
   * never learned the duration. The player needs to KNOW, because live wants
   * the opposite buffering policy from the short feed clips it is tuned for.
   */
  isLive?: boolean;
  durationMs: number;
  url: string;
  thumb: string;
  available: boolean;
  reason: string;
  title: string;
  description: string;
  playbackType: VideoType;
  variants: VideoVariant[];
}

export interface Photo {
  url: string;
  altText: string;
}

export interface Gif {
  url: string;
  thumb: string;
  altText: string;
}

export type Media =
  | { kind: MediaKind.Photo; photo: Photo }
  | { kind: MediaKind.Video; video: Video }
  | { kind: MediaKind.Gif; gif: Gif };

export interface GalleryPhoto {
  url: string;
  tweetId: string;
  color: string;
}

export type PhotoRail = GalleryPhoto[];

export interface Poll {
  options: string[];
  values: number[];
  votes: number;
  leader: number;
  status: string;
}

export interface Card {
  kind: CardKind;
  url: string;
  title: string;
  dest: string;
  text: string;
  image: string;
  video?: Video;
}

export interface TweetStats {
  replies: number;
  retweets: number;
  likes: number;
  views: number;
}

export interface Tweet {
  id: string;
  threadId: string;
  replyId: string;
  user: User;
  text: string;
  time: Date;
  reply: string[];
  pinned: boolean;
  hasThread: boolean;
  available: boolean;
  tombstone: string;
  location: string;
  source: string;
  stats: TweetStats;
  retweet?: Tweet;
  attribution?: User;
  mediaTags: User[];
  quote?: Tweet;
  card?: Card;
  poll?: Poll;
  media: Media[];
  history: string[];
  note: string;
  isAd: boolean;
  isAI: boolean;
  /**
   * True when the post is adult/sensitive — either X-flagged
   * (`possibly_sensitive` / sensitive media) or detected on-device by the NSFW
   * classifier. Optional for backward compatibility: treat `undefined` as false.
   */
  sensitive?: boolean;
  /**
   * True when the signed-in user has already retweeted this post (X's per-tweet
   * `legacy.retweeted`). Seeds the retweet button's toggle state so an
   * already-retweeted post shows as retweeted on load and can be un-retweeted.
   * Optional for backward compatibility: treat `undefined` as false.
   */
  retweeted?: boolean;
  /**
   * True when the signed-in user has already liked this post (`legacy.favorited`).
   * Seeds the like toggle so an already-liked post can be unliked.
   */
  liked?: boolean;
  /**
   * True when the signed-in user has already bookmarked this post
   * (`legacy.bookmarked`). Seeds the bookmark toggle.
   */
  bookmarked?: boolean;
}

export interface Query {
  kind: QueryKind;
  view: string;
  text: string;
  filters: string[];
  includes: string[];
  excludes: string[];
  fromUser: string[];
  since: string;
  until: string;
  minLikes: string;
  sep: string;
}

export interface Result<T> {
  content: T[];
  top: string;
  bottom: string;
  beginning: boolean;
  query: Query;
}

export interface Chain {
  content: Tweet[];
  hasMore: boolean;
  cursor: string;
}

export interface Conversation {
  tweet: Tweet;
  before: Chain;
  after: Chain;
  replies: Result<Chain>;
}

export interface EditHistory {
  latest: Tweet;
  history: Tweet[];
}

export type Timeline = Result<Tweet[]>;

export interface Profile {
  user: User;
  photoRail: PhotoRail;
  pinned?: Tweet;
  tweets: Timeline;
}

export interface List {
  id: string;
  name: string;
  userId: string;
  username: string;
  description: string;
  members: number;
  banner: string;
  /** Pinned timelines can be Lists or Communities — they use different APIs. */
  kind?: "list" | "community";
}

export type NotifKind =
  | "like"
  | "reply"
  | "retweet"
  | "follow"
  | "mention"
  | "quote"
  | "other";

export interface NotifItem {
  id: string;
  kind: NotifKind;
  actors: User[];
  tweet: Tweet | null;
  text: string;
  time: Date;
}

export interface DmConversation {
  id: string;
  participants: string[];
  lastText: string;
  time: Date;
  unread: boolean;
}

export interface DmMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  time: Date;
  /** Attached media URL (photo/gif/video) when present, else undefined. */
  mediaUrl?: string;
}

export interface Trend {
  name: string;
  tweetVolume?: number;
  url?: string;
}

export function emptyUser(username = ""): User {
  return {
    id: "",
    username,
    fullname: "",
    location: "",
    website: "",
    bio: "",
    userPic: "",
    banner: "",
    pinnedTweet: 0,
    following: 0,
    followers: 0,
    tweets: 0,
    likes: 0,
    media: 0,
    verifiedType: VerifiedType.None,
    protected: false,
    suspended: false,
    joinDate: new Date(),
  };
}

export function emptyTweet(): Tweet {
  return {
    id: "",
    threadId: "",
    replyId: "",
    user: emptyUser(),
    text: "",
    time: new Date(),
    reply: [],
    pinned: false,
    hasThread: false,
    available: false,
    tombstone: "",
    location: "",
    source: "",
    stats: { replies: 0, retweets: 0, likes: 0, views: 0 },
    mediaTags: [],
    media: [],
    history: [],
    note: "",
    isAd: false,
    isAI: false,
    sensitive: false,
  };
}

export function emptyQuery(): Query {
  return {
    kind: QueryKind.Posts,
    view: "",
    text: "",
    filters: [],
    includes: [],
    excludes: [],
    fromUser: [],
    since: "",
    until: "",
    minLikes: "",
    sep: "",
  };
}
