// SPDX-License-Identifier: AGPL-3.0-only
// Tweet parsers — ported from nitter/src/parser.nim
// Video / card / poll / tweet / media-entity / syndication parsing.

import type {
  User, Tweet, Video, VideoVariant, Media, Card, Poll,
} from "../types";
import {
  VerifiedType, VideoType, MediaKind, CardKind, emptyUser, emptyTweet,
} from "../types";
import {
  jget, jstr, jint, jbool, select, getTypeName, getId,
  getImageStr, getExpandedUrl, getMp4Resolution, parseTwitterDate,
} from "./helpers";
import { parseGraphUser } from "./user";

// --- Video parser ---

function parseVideoVariants(variants: any[]): VideoVariant[] {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => ({
    contentType: (jstr(v, "content_type") || "video/mp4") as VideoType,
    bitrate: jint(v, "bit_rate") || jint(v, "bitrate"),
    url: jstr(v, "url"),
    resolution: jstr(v, "content_type") === VideoType.Mp4 ? getMp4Resolution(jstr(v, "url")) : 0,
  }));
}

function parseVideo(js: any): Video {
  const video: Video = {
    thumb: getImageStr(jstr(js, "media_url_https")),
    available: true,
    title: jstr(js, "ext_alt_text"),
    description: "",
    url: "",
    reason: "",
    durationMs: jint(js, "video_info", "duration_millis"),
    playbackType: VideoType.Mp4,
    variants: parseVideoVariants(jget(js, "video_info", "variants")),
  };
  const status = jstr(js, "ext_media_availability", "status");
  if (status && status.toLowerCase() !== "available") video.available = false;
  const addTitle = jstr(js, "additional_media_info", "title");
  if (addTitle) video.title = addTitle;
  const addDesc = jstr(js, "additional_media_info", "description");
  if (addDesc) video.description = addDesc;
  return video;
}

// --- Card parser ---

function parseCard(js: any, urls: any): Card {
  const vals = jget(js, "binding_values");
  if (!vals) return { kind: CardKind.Unknown, url: "", title: "", dest: "", text: "", image: "" };
  const name = jstr(js, "name");
  const kindStr = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
  const kind = (Object.values(CardKind).includes(kindStr as CardKind) ? kindStr : CardKind.Unknown) as CardKind;
  const card: Card = {
    kind,
    url: jstr(vals, "website_url", "string_value") || jstr(js, "url"),
    title: jstr(vals, "title", "string_value"),
    dest: jstr(vals, "vanity_url", "string_value") || jstr(vals, "domain"),
    text: jstr(vals, "description", "string_value"),
    image: "",
  };
  const imageTypes = ["summary_photo_image", "player_image", "promo_image", "photo_image_full_size", "thumbnail_image", "thumbnail", "event_thumbnail", "image"];
  for (const typ of imageTypes) {
    const img = jstr(vals, `${typ}_large`, "image_value", "url");
    if (img) { card.image = getImageStr(img); break; }
  }
  if (Array.isArray(urls)) {
    for (const u of urls) {
      if (jstr(u, "url") === card.url) { card.url = getExpandedUrl(u, card.url); break; }
    }
  }
  return card;
}

// --- Poll parser ---

function parsePoll(js: any): Poll {
  const vals = jget(js, "binding_values");
  const name = jstr(js, "name");
  const numChoices = parseInt(name[4] ?? "2", 10);
  const poll: Poll = { options: [], values: [], votes: 0, leader: 0, status: "" };
  for (let i = 1; i <= numChoices; i++) {
    poll.values.push(parseInt(jstr(vals, `choice${i}_count`, "string_value") || "0", 10));
    poll.options.push(jstr(vals, `choice${i}_label`, "string_value"));
  }
  const endTime = jstr(vals, "end_datetime_utc", "string_value");
  if (endTime) {
    const end = new Date(endTime);
    if (end > new Date()) {
      const diff = end.getTime() - Date.now();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      poll.status = hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;
    } else {
      poll.status = "Final results";
    }
  }
  poll.votes = poll.values.reduce((a, b) => a + b, 0);
  poll.leader = poll.values.indexOf(Math.max(...poll.values));
  return poll;
}

// --- Tweet parser ---

function parseTweet(js: any, jsCard?: any, replyId = ""): Tweet {
  if (!js) return emptyTweet();
  const timeStr = jstr(js, "created_at");
  const timeMs = jint(js, "created_at_ms");
  const tweet: Tweet = {
    id: getId(jget(js, "id_str")),
    threadId: getId(jget(js, "conversation_id_str")),
    replyId: getId(jget(js, "in_reply_to_status_id_str")) || replyId,
    text: jstr(js, "full_text"),
    time: timeStr ? parseTwitterDate(timeStr) : timeMs ? new Date(timeMs) : new Date(),
    hasThread: !!jget(js, "self_thread"),
    available: true,
    user: { ...emptyUser(), id: jstr(js, "user_id_str") },
    reply: [], pinned: false, tombstone: "", location: "", source: "",
    stats: { replies: jint(js, "reply_count"), retweets: jint(js, "retweet_count"), likes: jint(js, "favorite_count"), views: jint(js, "views_count") },
    mediaTags: [], media: [], history: [], note: "", isAd: false, isAI: false,
    sensitive: jbool(js, "possibly_sensitive"),
    // X's per-tweet "did the signed-in user already retweet/like/bookmark this"
    // flags; live on the same `legacy` object as the reply/retweet/favorite counts.
    retweeted: jbool(js, "retweeted"),
    liked: jbool(js, "favorited"),
    bookmarked: jbool(js, "bookmarked"),
  };
  if (tweet.hasThread && !tweet.threadId) tweet.threadId = getId(jget(js, "self_thread", "id_str"));
  if (jget(js, "retweeted_status")) tweet.retweet = emptyTweet();
  else if (jbool(js, "is_quote_status")) tweet.quote = { ...emptyTweet(), id: getId(jget(js, "quoted_status_id_str")) };
  const rtId = jget(js, "retweeted_status_id_str");
  if (rtId) { tweet.retweet = { ...emptyTweet(), id: getId(rtId) }; return tweet; }
  if (jsCard) {
    const cardName = jstr(jsCard, "name");
    if (cardName.includes("poll")) tweet.poll = parsePoll(jsCard);
    else if (cardName !== "amplify") tweet.card = parseCard(jsCard, jget(js, "entities", "urls"));
  }
  const extMedia = jget(js, "extended_entities", "media");
  if (Array.isArray(extMedia)) {
    for (const m of extMedia) {
      if (jbool(m, "sensitive") || jget(m, "ext_sensitive_media_warning") || jget(m, "sensitive_media_warning")) {
        tweet.sensitive = true;
      }
      const typeName = jstr(m, "type");
      if (typeName === "photo") {
        tweet.media.push({ kind: MediaKind.Photo, photo: { url: getImageStr(jstr(m, "media_url_https")), altText: jstr(m, "ext_alt_text") } });
      } else if (typeName === "video") {
        tweet.media.push({ kind: MediaKind.Video, video: parseVideo(m) });
      } else if (typeName === "animated_gif") {
        tweet.media.push({ kind: MediaKind.Gif, gif: { url: getImageStr(jstr(m, "video_info", "variants", 0, "url")), thumb: getImageStr(jstr(m, "media_url_https")), altText: jstr(m, "ext_alt_text") } });
      }
      const mediaUrl = jstr(m, "url");
      if (mediaUrl && tweet.text.endsWith(mediaUrl)) tweet.text = tweet.text.slice(0, -mediaUrl.length).trim();
    }
  }
  return tweet;
}

export function parseGraphTweet(js: any, defaultId = ""): Tweet {
  if (!js) return emptyTweet();
  const typeName = getTypeName(js);
  if (typeName === "TweetUnavailable") return emptyTweet();
  if (typeName === "TweetTombstone") {
    const text = select(jget(js, "tombstone", "richText", "text"), jget(js, "tombstone", "text", "text"));
    return { ...emptyTweet(), id: defaultId, text: String(text ?? "").replace(/ Learn more$/, "") };
  }
  if (typeName === "TweetPreviewDisplay") return { ...emptyTweet(), text: "This tweet is only available to subscribers." };
  if (typeName === "TweetWithVisibilityResults") return parseGraphTweet(jget(js, "tweet"));
  if (!jget(js, "legacy") && !jget(js, "rest_id")) return emptyTweet();

  let jsCard = select(jget(js, "card"), jget(js, "tweet_card"), jget(js, "legacy", "tweet_card"));
  if (jsCard) {
    const legacyCard = jget(jsCard, "legacy");
    if (legacyCard) {
      const bindingArray = jget(legacyCard, "binding_values");
      if (Array.isArray(bindingArray)) {
        const bindingObj: Record<string, any> = {};
        for (const item of bindingArray) bindingObj[jstr(item, "key")] = jget(item, "value");
        jsCard = { name: jget(legacyCard, "name"), url: jget(legacyCard, "url"), binding_values: bindingObj };
      }
    }
  }

  const rtResult = select(jget(js, "retweeted_status_result", "result"), jget(js, "repostedStatusResults", "result"));
  if (rtResult && jget(rtResult, "legacy")) {
    const tweet = parseTweet(jget(js, "legacy"), jsCard);
    tweet.id = getId(jget(js, "rest_id"));
    tweet.user = parseGraphUser(jget(js, "core"));
    tweet.retweet = parseGraphTweet(rtResult);
    // Surface the reposted post's sensitivity on the wrapper so a single
    // `tweet.sensitive` check covers reposts.
    tweet.sensitive = tweet.sensitive || jbool(js, "possibly_sensitive") || !!tweet.retweet.sensitive;
    return tweet;
  }

  let tweet: Tweet;
  const replyId = getId(jget(js, "reply_to_results", "rest_id"));
  if (jget(js, "details")) {
    tweet = { ...emptyTweet(), id: getId(jget(js, "rest_id")), available: true, text: jstr(js, "details", "full_text"), time: new Date(jint(js, "details", "created_at_ms")), replyId, isAd: jbool(js, "content_disclosure", "advertising_disclosure", "is_paid_promotion"), isAI: jbool(js, "content_disclosure", "ai_generated_disclosure", "has_ai_generated_media"), stats: { replies: jint(js, "counts", "reply_count"), retweets: jint(js, "counts", "retweet_count"), likes: jint(js, "counts", "favorite_count"), views: 0 } };
  } else {
    tweet = parseTweet(jget(js, "legacy"), jsCard, replyId);
    tweet.id = getId(jget(js, "rest_id"));
  }

  tweet.user = parseGraphUser(jget(js, "core"));
  if (tweet.reply.length === 0) {
    const replyToUser = jstr(js, "reply_to_user_results", "result", "core", "screen_name");
    if (replyToUser) tweet.reply = [replyToUser];
  }
  const viewCount = jstr(js, "views", "count");
  if (viewCount) tweet.stats.views = parseInt(viewCount, 10) || 0;
  const noteText = jstr(js, "note_tweet", "note_tweet_results", "result", "text");
  if (noteText) tweet.text = noteText;
  parseMediaEntities(js, tweet);
  const quoted = select(jget(js, "quoted_status_result", "result"), jget(js, "quotedPostResults", "result"));
  if (quoted) tweet.quote = parseGraphTweet(quoted);
  else if (!tweet.quote) {
    const qId = getId(jget(js, "legacy", "quoted_status_id_str"));
    if (qId) tweet.quote = { ...emptyTweet(), id: qId };
  }
  const editIds = jget(js, "edit_control", "edit_control_initial", "edit_tweet_ids");
  if (Array.isArray(editIds)) tweet.history = editIds.map((id: any) => String(id));
  const birdwatch = jget(js, "birdwatch_pivot");
  if (birdwatch) tweet.note = jstr(birdwatch, "subtitle", "text");
  // X marks adult/sensitive posts at the result level too (in addition to the
  // legacy `possibly_sensitive` set by parseTweet and any sensitive media flag).
  tweet.sensitive = tweet.sensitive || jbool(js, "possibly_sensitive") || jbool(js, "sensitive");
  return tweet;
}

// --- Media entities (new format) ---

function parseMediaEntities(js: any, tweet: Tweet): void {
  const mediaEntities = jget(js, "media_entities");
  if (!Array.isArray(mediaEntities) || mediaEntities.length === 0) return;
  const parsed: Media[] = [];
  for (const entity of mediaEntities) {
    const mediaResult = jget(entity, "media_results", "result");
    if (jbool(entity, "sensitive") || jget(entity, "sensitive_media_warning") ||
        jbool(mediaResult, "sensitive") || jget(mediaResult, "sensitive_media_warning")) {
      tweet.sensitive = true;
    }
    const mediaInfo = jget(mediaResult, "media_info");
    if (!mediaInfo) continue;
    const typeName = getTypeName(mediaInfo);
    if (typeName === "ApiImage") {
      parsed.push({ kind: MediaKind.Photo, photo: { url: getImageStr(jstr(mediaInfo, "original_img_url")), altText: jstr(mediaInfo, "alt_text") } });
    } else if (typeName === "ApiVideo") {
      const status = jstr(entity, "media_results", "result", "media_availability_v2", "status");
      parsed.push({ kind: MediaKind.Video, video: { available: status === "Available", thumb: getImageStr(jstr(mediaInfo, "preview_image", "original_img_url")), title: jstr(mediaInfo, "alt_text"), description: "", url: "", reason: "", durationMs: jint(mediaInfo, "duration_millis"), playbackType: VideoType.Mp4, variants: parseVideoVariants(jget(mediaInfo, "variants")) } });
    } else if (typeName === "ApiGif") {
      parsed.push({ kind: MediaKind.Gif, gif: { url: getImageStr(jstr(mediaInfo, "variants", 0, "url")), thumb: getImageStr(jstr(mediaInfo, "preview_image", "original_img_url")), altText: jstr(mediaInfo, "alt_text") } });
    }
  }
  // A single entity with an unrecognized type or missing media_info must not
  // discard the rest of an otherwise-parseable set — take whatever parsed.
  if (parsed.length > 0) tweet.media = parsed;
}

/**
 * Parse a tweet from Twitter's syndication/embed API.
 * The syndication response has a simpler flat structure compared to GraphQL.
 */
export function parseSyndicationTweet(js: any): Tweet {
  if (!js || !js.id_str) return emptyTweet();

  const user: User = {
    id: js.user?.id_str ?? "",
    username: js.user?.screen_name ?? "",
    fullname: js.user?.name ?? "",
    location: "",
    website: "",
    bio: "",
    userPic: getImageStr(js.user?.profile_image_url_https ?? "").replace("_normal", ""),
    banner: "",
    pinnedTweet: 0,
    following: 0,
    followers: 0,
    tweets: 0,
    likes: 0,
    media: 0,
    // Same precedence as parser/user.ts: an organisation check (Business /
    // Government) outranks the paid blue one — Work Mode's context signal
    // (safety/contextSignals.ts) depends on telling them apart.
    verifiedType: js.user?.verified_type === "Business" ? VerifiedType.Business
      : js.user?.verified_type === "Government" ? VerifiedType.Government
      : js.user?.is_blue_verified ? VerifiedType.Blue : VerifiedType.None,
    protected: false,
    suspended: false,
    joinDate: new Date(0),
  };

  const tweet: Tweet = {
    id: js.id_str ?? "",
    threadId: "",
    replyId: js.in_reply_to_status_id_str ?? "",
    text: js.text ?? "",
    time: js.created_at ? parseTwitterDate(js.created_at) : new Date(),
    hasThread: false,
    available: true,
    user,
    reply: js.in_reply_to_screen_name ? [js.in_reply_to_screen_name] : [],
    pinned: false,
    tombstone: "",
    location: "",
    source: "",
    stats: {
      replies: js.conversation_count ?? 0,
      retweets: js.retweet_count ?? 0,
      likes: js.favorite_count ?? 0,
      views: 0,
    },
    mediaTags: [],
    media: [],
    history: [],
    note: "",
    isAd: false,
    isAI: false,
  };

  // Parse media from syndication format
  if (Array.isArray(js.mediaDetails)) {
    for (const m of js.mediaDetails) {
      if (m.type === "photo") {
        tweet.media.push({
          kind: MediaKind.Photo,
          photo: { url: getImageStr(m.media_url_https ?? ""), altText: m.ext_alt_text ?? "" },
        });
      } else if (m.type === "video") {
        tweet.media.push({
          kind: MediaKind.Video,
          video: parseVideo(m),
        });
      } else if (m.type === "animated_gif") {
        const gifUrl = m.video_info?.variants?.[0]?.url ?? "";
        tweet.media.push({
          kind: MediaKind.Gif,
          gif: { url: getImageStr(gifUrl), thumb: getImageStr(m.media_url_https ?? ""), altText: m.ext_alt_text ?? "" },
        });
      }
    }
  }

  // Parse quoted tweet
  if (js.quoted_tweet) {
    tweet.quote = parseSyndicationTweet(js.quoted_tweet);
  }

  return tweet;
}
