// SPDX-License-Identifier: AGPL-3.0-only
// Notifications timeline parser — ported from nitter/src/parser.nim

import type { User, Tweet } from "../types";
import { jget, jstr, select, getTypeName } from "./helpers";
import { parseGraphUser } from "./user";
import { parseGraphTweet } from "./tweet";

// --- Notifications Timeline Parser ---

export interface NotificationEntry {
  type: string; // "like" | "retweet" | "reply" | "mention" | "follow" | "quote" | "other"
  icon: string;
  message: string;
  users: User[];
  tweet: Tweet | null;
  time: Date;
  id: string;
}

export function parseNotificationsTimeline(js: any): { notifications: NotificationEntry[]; nextCursor: string } {
  const notifications: NotificationEntry[] = [];
  let nextCursor = "";

  const instructions: any[] = (
    jget(js, "data", "timeline_by_id", "timeline", "instructions") ??
    jget(js, "data", "timeline", "timeline", "instructions") ??
    []
  );

  // First pass: collect all users from globalObjects or inline user results
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

        if (entryId.startsWith("notification-")) {
          const content = jget(entry, "content", "itemContent") ?? jget(entry, "content");
          const notifType = jstr(content, "notification_type") || jstr(content, "clientEventInfo", "element") || "other";

          // Extract users from the notification
          const userResults = jget(content, "tweet_results") ?? [];
          const users: User[] = [];
          const fromUsers = jget(content, "from_users") ?? [];
          if (Array.isArray(fromUsers)) {
            for (const fu of fromUsers) {
              const userResult = jget(fu, "user_results", "result");
              if (userResult) users.push(parseGraphUser(userResult));
            }
          }

          // Extract tweet if present
          let tweet: Tweet | null = null;
          const tweetResult = select(
            jget(content, "tweet", "tweet_results", "result"),
            jget(content, "targetObjects", 0, "tweet", "tweet_results", "result"),
            jget(content, "tweet_results", "result")
          );
          if (tweetResult) {
            tweet = parseGraphTweet(tweetResult);
          }

          // Determine notification type
          let type = "other";
          let icon = "🔔";
          const ntLower = notifType.toLowerCase();
          if (ntLower.includes("like") || ntLower.includes("favorite")) { type = "like"; icon = "❤️"; }
          else if (ntLower.includes("retweet")) { type = "retweet"; icon = "🔁"; }
          else if (ntLower.includes("reply")) { type = "reply"; icon = "💬"; }
          else if (ntLower.includes("mention")) { type = "mention"; icon = "📢"; }
          else if (ntLower.includes("follow")) { type = "follow"; icon = "👤"; }
          else if (ntLower.includes("quote")) { type = "quote"; icon = "🗨️"; }

          // Build message
          const userNames = users.slice(0, 3).map(u => u.fullname || u.username).join(", ");
          const extra = users.length > 3 ? ` and ${users.length - 3} others` : "";
          let message = `${userNames}${extra}`;
          if (type === "like") message += " liked your post";
          else if (type === "retweet") message += " reposted your post";
          else if (type === "reply") message += " replied to your post";
          else if (type === "mention") message += " mentioned you";
          else if (type === "follow") message += " followed you";
          else if (type === "quote") message += " quoted your post";
          else message += " interacted with you";

          notifications.push({
            type,
            icon,
            message,
            users,
            tweet,
            time: tweet?.time ?? new Date(),
            id: entryId,
          });
        }
      }
    }
  }

  return { notifications, nextCursor };
}
