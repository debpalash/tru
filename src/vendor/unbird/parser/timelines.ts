// SPDX-License-Identifier: AGPL-3.0-only
// Timeline / conversation / search / photo-rail parsers — ported from nitter/src/parser.nim

import type {
  User, Tweet, Chain, Conversation, Profile, Result, EditHistory, GalleryPhoto,
} from "../types";
import {
  MediaKind, emptyUser, emptyTweet, emptyQuery,
} from "../types";
import {
  jget, jstr, select, getTypeName, getEntryId, getTweetResult, getId,
} from "./helpers";
import { parseGraphUser } from "./user";
import { parseGraphTweet } from "./tweet";

// --- Helpers ---

function extractTweetsFromEntry(e: any): Tweet[] {
  const tweetResult = getTweetResult(e);
  if (tweetResult) {
    const tweet = parseGraphTweet(tweetResult, getId(getEntryId(e)));
    if (!tweet.available || !tweet.id) tweet.id = getId(getEntryId(e));
    return [tweet];
  }
  const items = jget(e, "content", "items");
  if (!Array.isArray(items)) return [];
  const tweets: Tweet[] = [];
  for (const item of items) {
    const tr = getTweetResult(item, "item");
    if (tr) {
      const tweet = parseGraphTweet(tr, getId(getEntryId(item)));
      if (!tweet.available || !tweet.id) tweet.id = getId(getEntryId(item));
      tweets.push(tweet);
    }
  }
  return tweets;
}

function extractGalleryPhoto(t: Tweet): GalleryPhoto {
  let url = "";
  if (t.media.length > 0) {
    const first = t.media[0]!;
    if (first.kind === MediaKind.Photo) url = first.photo.url;
    else if (first.kind === MediaKind.Video) url = first.video.thumb;
    else if (first.kind === MediaKind.Gif) url = first.gif.thumb;
  } else if (t.card) { url = t.card.image; }
  return { url, tweetId: String(t.id), color: "" };
}

// --- Timeline / Conversation / List parsers ---

function parseGraphThread(js: any): { thread: Chain; self: boolean } {
  const thread: Chain = { content: [], hasMore: false, cursor: "" };
  let isSelf = false;
  const items = jget(js, "content", "items");
  if (!Array.isArray(items)) return { thread, self: isSelf };
  for (const t of items) {
    const entryId = getEntryId(t);
    if (entryId.includes("tweet-") && !entryId.includes("promoted")) {
      const tweetResult = getTweetResult(t, "item");
      if (tweetResult) {
        thread.content.push(parseGraphTweet(tweetResult, getId(entryId)));
        const displayType = select(jget(t, "item", "content", "tweet_display_type"), jget(t, "item", "itemContent", "tweetDisplayType"));
        if (String(displayType) === "SelfThread") isSelf = true;
      } else {
        thread.content.push({ ...emptyTweet(), id: getId(entryId) });
      }
    } else if (entryId.includes("cursor-showmore")) {
      thread.cursor = jstr(t, "item", "content", "value");
      thread.hasMore = true;
    }
  }
  return { thread, self: isSelf };
}

export function parseGraphTimeline(js: any, after = ""): Profile {
  const profile: Profile = { user: emptyUser(), photoRail: [], tweets: { content: [], top: "", bottom: "", beginning: !after, query: emptyQuery() } };
  const instructions = select(
    jget(js, "data", "list", "tweets_timeline", "timeline", "instructions"),
    jget(js, "data", "list", "timeline_response", "timeline", "instructions"),
    jget(js, "data", "user", "result", "timeline_v2", "timeline", "instructions"),
    jget(js, "data", "user", "result", "timeline", "timeline", "instructions"),
    jget(js, "data", "user_result", "result", "timeline_response", "timeline", "instructions"),
    jget(js, "data", "communityResults", "result", "community_timeline", "timeline", "instructions"),
    jget(js, "data", "communityResults", "result", "ranked_community_timeline", "timeline", "instructions")
  );
  if (!Array.isArray(instructions)) return profile;

  for (const i of instructions) {
    const moduleItems = jget(i, "moduleItems");
    if (Array.isArray(moduleItems)) {
      for (const item of moduleItems) {
        const tweetResult = getTweetResult(item, "item");
        if (tweetResult) {
          const tweet = parseGraphTweet(tweetResult);
          if (!tweet.available) tweet.id = getId(getEntryId(item));
          profile.tweets.content.push([tweet]);
        }
      }
      continue;
    }
    const entries = jget(i, "entries");
    if (Array.isArray(entries)) {
      for (const e of entries) {
        const entryId = getEntryId(e);

        if (entryId.includes("tweet") || entryId.startsWith("profile-grid")) {
          const tweets = extractTweetsFromEntry(e);
          if (tweets.length > 0) profile.tweets.content.push(tweets);
        } else if (entryId.includes("-conversation-") || entryId.startsWith("homeConversation")) {
          const { thread } = parseGraphThread(e);
          if (thread.content.length > 0) profile.tweets.content.push(thread.content);
        } else if (entryId.startsWith("cursor-bottom")) {
          profile.tweets.bottom = jstr(e, "content", "value");
        }
      }
    }
    if (!after && getTypeName(i) === "TimelinePinEntry") {
      const tweets = extractTweetsFromEntry(jget(i, "entry"));
      if (tweets.length > 0) { tweets[0]!.pinned = true; profile.pinned = tweets[0]; }
    }
  }
  return profile;
}

export function parseGraphConversation(js: any, tweetId: string): Conversation {
  const conv: Conversation = { tweet: emptyTweet(), before: { content: [], hasMore: false, cursor: "" }, after: { content: [], hasMore: false, cursor: "" }, replies: { content: [], top: "", bottom: "", beginning: true, query: emptyQuery() } };
  const instructions = select(
    jget(js, "data", "timelineResponse", "instructions"),
    jget(js, "data", "timeline_response", "instructions"),
    jget(js, "data", "threaded_conversation_with_injections_v2", "instructions")
  );
  if (!Array.isArray(instructions)) return conv;

  for (const i of instructions) {
    if (getTypeName(i) !== "TimelineAddEntries") continue;
    const entries = jget(i, "entries");
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const entryId = getEntryId(e);
      if (entryId.startsWith("tweet-")) {
        const tweetResult = getTweetResult(e);
        if (tweetResult) {
          const tweet = parseGraphTweet(tweetResult);
          if (!tweet.available) tweet.id = getId(entryId);
          if (entryId.endsWith(tweetId)) conv.tweet = tweet;
          else conv.before.content.push(tweet);
        } else if (!entryId.endsWith(tweetId)) {
          conv.before.content.push({ ...emptyTweet(), id: getId(entryId) });
        }
      } else if (entryId.startsWith("conversationthread")) {
        const { thread, self } = parseGraphThread(e);
        if (self) conv.after = thread;
        else if (thread.content.length > 0) conv.replies.content.push(thread);
      } else if (entryId.startsWith("cursor-bottom")) {
        conv.replies.bottom = select(jstr(e, "content", "value"), jstr(e, "content", "content", "value"), jstr(e, "content", "itemContent", "value")) ?? "";
      }
    }
  }
  return conv;
}

export function parseGraphSearch<T>(js: any, after = ""): Result<any> {
  const result: Result<any> = { content: [], top: "", bottom: "", beginning: !after, query: emptyQuery() };
  const instructions = select(
    jget(js, "data", "search", "timeline_response", "timeline", "instructions"),
    jget(js, "data", "search_by_raw_query", "search_timeline", "timeline", "instructions")
  );
  if (!Array.isArray(instructions)) return result;
  for (const instruction of instructions) {
    const typ = getTypeName(instruction);
    if (typ === "TimelineAddEntries") {
      for (const e of jget(instruction, "entries") ?? []) {
        const entryId = getEntryId(e);
        if (entryId.includes("tweet")) {
          const tweetResult = getTweetResult(e);
          if (tweetResult) {
            const tweet = parseGraphTweet(tweetResult);
            if (!tweet.available) tweet.id = getId(entryId);
            result.content.push([tweet]);
          }
        } else if (entryId.startsWith("user")) {
          const userResult = jget(e, "content", "itemContent");
          if (userResult) result.content.push(parseGraphUser(userResult));
        }
        if (entryId.startsWith("cursor-bottom")) result.bottom = jstr(e, "content", "value");
      }
    } else if (typ === "TimelineReplaceEntry") {
      if (jstr(instruction, "entry_id_to_replace").startsWith("cursor-bottom")) {
        result.bottom = jstr(instruction, "entry", "content", "value");
      }
    }
  }
  return result;
}

/**
 * Parse a user-recommendation timeline (e.g. ConnectTabTimeline / who-to-follow)
 * into Result<User>. These timelines mix plain user entries with "module"
 * entries (vertical lists of users), so we pull users from both shapes.
 */
export function parseGraphUserTimeline(js: any, after = ""): Result<User> {
  const result: Result<User> = { content: [], top: "", bottom: "", beginning: !after, query: emptyQuery() };
  const instructions = select(
    jget(js, "data", "connect_tab_timeline", "timeline", "instructions"),
    jget(js, "data", "connect_tab_timeline", "timeline_response", "timeline", "instructions"),
    jget(js, "data", "timeline_response", "timeline", "instructions"),
    jget(js, "data", "timeline", "timeline", "instructions")
  );
  if (!Array.isArray(instructions)) return result;
  const seen = new Set<string>();
  const pushUser = (itemContent: any) => {
    if (!itemContent) return;
    const u = parseGraphUser(itemContent);
    if (u?.id && u.username && !seen.has(u.id)) {
      seen.add(u.id);
      result.content.push(u);
    }
  };
  for (const ins of instructions) {
    for (const e of jget(ins, "entries") ?? []) {
      pushUser(jget(e, "content", "itemContent"));
      // Module entries hold a vertical grid of users.
      for (const item of jget(e, "content", "items") ?? []) {
        pushUser(jget(item, "item", "itemContent"));
      }
      if (getEntryId(e).startsWith("cursor-bottom")) {
        result.bottom = jstr(e, "content", "value");
      }
    }
  }
  return result;
}

export function parseGraphTweetResult(js: any): Tweet {
  const tweetResult = select(
    jget(js, "data", "tweet_result", "result"),
    jget(js, "data", "tweetResult", "result")
  );
  return tweetResult ? parseGraphTweet(tweetResult) : emptyTweet();
}

export function parseGraphEditHistory(js: any, tweetId: string): EditHistory {
  const history: EditHistory = { latest: emptyTweet(), history: [] };
  const instructions = jget(js, "data", "tweet_result_by_rest_id", "result", "edit_history_timeline", "timeline", "instructions");
  if (!Array.isArray(instructions)) return history;
  for (const i of instructions) {
    if (getTypeName(i) !== "TimelineAddEntries") continue;
    for (const e of jget(i, "entries") ?? []) {
      const entryId = getEntryId(e);
      if (entryId === "latestTweet") {
        const items = jget(e, "content", "items");
        if (Array.isArray(items) && items[0]) {
          const tweetResult = getTweetResult(items[0], "item");
          if (tweetResult) history.latest = parseGraphTweet(tweetResult);
        }
      } else if (entryId === "staleTweets") {
        for (const item of jget(e, "content", "items") ?? []) {
          const tweetResult = getTweetResult(item, "item");
          if (tweetResult) history.history.push(parseGraphTweet(tweetResult));
        }
      }
    }
  }
  return history;
}

export function parseGraphPhotoRail(js: any): GalleryPhoto[] {
  const result: GalleryPhoto[] = [];
  const instructions = select(
    jget(js, "data", "user", "result", "timeline", "timeline", "instructions"),
    jget(js, "data", "user_result", "result", "timeline_response", "timeline", "instructions")
  );
  if (!Array.isArray(instructions)) return result;
  for (const i of instructions) {
    const moduleItems = jget(i, "moduleItems");
    if (Array.isArray(moduleItems)) {
      for (const item of moduleItems) {
        const tweetResult = getTweetResult(item, "item");
        if (tweetResult) {
          const t = parseGraphTweet(tweetResult);
          const photo = extractGalleryPhoto(t);
          if (photo.url) result.push(photo);
          if (result.length === 16) return result;
        }
      }
      continue;
    }
    if (getTypeName(i) !== "TimelineAddEntries") continue;
    for (const e of jget(i, "entries") ?? []) {
      const entryId = getEntryId(e);
      if (entryId.startsWith("tweet") || entryId.startsWith("profile-grid")) {
        for (const t of extractTweetsFromEntry(e)) {
          const photo = extractGalleryPhoto(t);
          if (photo.url) result.push(photo);
          if (result.length === 16) return result;
        }
      }
    }
  }
  return result;
}
