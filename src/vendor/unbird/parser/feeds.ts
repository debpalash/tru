// SPDX-License-Identifier: AGPL-3.0-only
// Home / Bookmarks timeline parsers — ported from nitter/src/parser.nim

import type { Tweet } from "../types";
import { jget, jstr, getTypeName, getTweetResult } from "./helpers";
import { parseGraphTweet } from "./tweet";

/**
 * Parse the HomeLatestTimeline / HomeTimeline GraphQL response.
 * The response lives at data.home.home_timeline_urt.instructions
 */
export function parseHomeTimeline(js: any): { tweets: Tweet[]; nextCursor: string; topCursor: string } {
  const tweets: Tweet[] = [];
  let nextCursor = "";
  let topCursor = "";

  const instructions: any[] = (
    jget(js, "data", "home", "home_timeline_urt", "instructions") ??
    jget(js, "data", "home_timeline_by_home_id", "timeline", "instructions") ??
    []
  );

  for (const instruction of instructions) {
    const typ = getTypeName(instruction);
    if (typ === "TimelineAddEntries" || instruction.entries) {
      for (const entry of (instruction.entries ?? [])) {
        const entryId: string = jstr(entry, "entryId");

        if (entryId.startsWith("cursor-bottom") || entryId.startsWith("cursor-showMoreThreads")) {
          const val = jstr(entry, "content", "value") || jstr(entry, "content", "itemContent", "value");
          if (val) nextCursor = val;
          continue;
        }

        // Top cursor: fetching WITH it returns only entries newer than this
        // page — the delta-poll handle (perf roadmap P3).
        if (entryId.startsWith("cursor-top")) {
          const val = jstr(entry, "content", "value") || jstr(entry, "content", "itemContent", "value");
          if (val) topCursor = val;
          continue;
        }

        // Single tweet entry — excludes "promoted-tweet-..." (ads injected into the home feed)
        if (entryId.includes("tweet-") && !entryId.includes("promoted")) {
          const tweetResult = getTweetResult(entry);
          if (tweetResult) {
            const tweet = parseGraphTweet(tweetResult);
            if (tweet.id) tweets.push(tweet);
          }
          continue;
        }
        if (entryId.includes("promoted")) continue;

        // Threaded tweet module (e.g. home-conversation-*)
        const items: any[] = jget(entry, "content", "items") ?? [];
        for (const item of items) {
          const tweetResult = getTweetResult(item, "item");
          if (tweetResult) {
            const tweet = parseGraphTweet(tweetResult);
            if (tweet.id) tweets.push(tweet);
          }
        }
      }
    } else if (typ === "TimelineReplaceEntry") {
      const replaceEntryId = jstr(instruction, "entry_id_to_replace");
      if (replaceEntryId.startsWith("cursor-bottom")) {
        nextCursor = jstr(instruction, "entry", "content", "value");
      } else if (replaceEntryId.startsWith("cursor-top")) {
        topCursor = jstr(instruction, "entry", "content", "value");
      }
    }
  }

  return { tweets, nextCursor, topCursor };
}

// --- Bookmarks Timeline Parser ---

export function parseBookmarksTimeline(js: any): { tweets: Tweet[]; nextCursor: string } {
  const tweets: Tweet[] = [];
  let nextCursor = "";

  const instructions: any[] = (
    jget(js, "data", "bookmark_timeline_v2", "timeline", "instructions") ??
    jget(js, "data", "bookmark_timeline", "timeline", "instructions") ??
    []
  );

  for (const instruction of instructions) {
    const typ = getTypeName(instruction);
    if (typ === "TimelineAddEntries" || instruction.entries) {
      for (const entry of (instruction.entries ?? [])) {
        const entryId: string = jstr(entry, "entryId");

        if (entryId.startsWith("cursor-bottom")) {
          const val = jstr(entry, "content", "value") || jstr(entry, "content", "itemContent", "value");
          if (val) nextCursor = val;
          continue;
        }

        if (entryId.includes("tweet")) {
          const tweetResult = getTweetResult(entry);
          if (tweetResult) {
            const tweet = parseGraphTweet(tweetResult);
            if (tweet.id) tweets.push(tweet);
          }
        }
      }
    }
  }

  return { tweets, nextCursor };
}
