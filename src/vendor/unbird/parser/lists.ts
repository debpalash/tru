// SPDX-License-Identifier: AGPL-3.0-only
// List / follow parsers — ported from nitter/src/parser.nim

import type { User, List } from "../types";
import { jget, jstr, jint, select, getImageStr } from "./helpers";
import { parseGraphUser } from "./user";

export function parseGraphList(js: any): List {
  const list = select(jget(js, "data", "user_by_screen_name", "list"), jget(js, "data", "list"));
  if (!list) return { id: "", name: "", userId: "", username: "", description: "", members: 0, banner: "" };
  return {
    id: jstr(list, "id_str"), name: jstr(list, "name"),
    username: jstr(list, "user_results", "result", "legacy", "screen_name"),
    userId: jstr(list, "user_results", "result", "rest_id"),
    description: jstr(list, "description"), members: jint(list, "member_count"),
    banner: getImageStr(jstr(list, "custom_banner_media", "media_info", "original_img_url")),
  };
}

/**
 * Best-effort parse of ListOwnerships / ListMemberships / management timeline
 * list entries. Walks the whole GraphQL tree for list-shaped objects so either
 * op's response shape works without a hard schema dependency.
 */
export function parseListOwnerships(js: any): List[] {
  const lists: List[] = [];
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    // A list-shaped object (id + name + list-ish counters/description).
    // Skip pure User nodes that also have name + id.
    const id = jstr(node, "id_str") || jstr(node, "rest_id") || jstr(node, "id");
    const name = jstr(node, "name");
    const hasListShape =
      jget(node, "member_count") != null ||
      jget(node, "subscribers_count") != null ||
      jget(node, "subscriber_count") != null ||
      (jstr(node, "description") !== undefined &&
        (jget(node, "custom_banner_media") != null || jget(node, "default_banner_media") != null || jget(node, "mode") != null));
    if (id && name && hasListShape) {
      if (!lists.some((l) => l.id === id)) {
        lists.push({
          kind: "list",
          id: String(id),
          name,
          username:
            jstr(node, "user_results", "result", "legacy", "screen_name") ||
            jstr(node, "user_results", "result", "core", "screen_name"),
          userId: jstr(node, "user_results", "result", "rest_id"),
          description: jstr(node, "description"),
          members: jint(node, "member_count"),
          banner: getImageStr(jstr(node, "custom_banner_media", "media_info", "original_img_url")),
        });
      }
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") walk(v);
    }
  };
  walk(js);
  return lists;
}

/** Alias — ListMemberships uses the same list-shaped nodes. */
export const parseListMemberships = parseListOwnerships;

export function parsePinnedLists(js: any): List[] {
  const lists: List[] = [];
  const pinned = jget(js, "data", "pinned_timelines", "pinned_timelines") ?? [];
  for (const item of pinned) {
    const typename = jstr(item, "__typename");
    if (typename === "CommunityPinnedTimeline") {
      const community = jget(item, "community_results", "result");
      if (community) {
        lists.push({
          kind: "community",
          id: jstr(community, "id_str"),
          name: jstr(community, "name"),
          username: jstr(community, "admin_results", "result", "legacy", "screen_name") ||
                    jstr(community, "creator_results", "result", "legacy", "screen_name"),
          userId: jstr(community, "admin_results", "result", "rest_id") ||
                  jstr(community, "creator_results", "result", "rest_id"),
          description: jstr(community, "description"),
          members: jint(community, "member_count"),
          banner: getImageStr(jstr(community, "custom_banner_media", "media_info", "original_img_url")),
        });
      }
    } else if (typename === "ListPinnedTimeline") {
      const listObj = jget(item, "list");
      if (listObj) {
        lists.push({
          kind: "list",
          id: jstr(listObj, "id_str"),
          name: jstr(listObj, "name"),
          username: jstr(listObj, "user_results", "result", "legacy", "screen_name"),
          userId: jstr(listObj, "user_results", "result", "rest_id"),
          description: jstr(listObj, "description"),
          members: jint(listObj, "member_count"),
          banner: getImageStr(jstr(listObj, "custom_banner_media", "media_info", "original_img_url")),
        });
      }
    }
  }
  return lists;
}

export function parseFollowList(js: any): { users: User[]; nextCursor: string } {
  const users: User[] = [];
  let nextCursor = "";

  // The Following/Followers response lives at data.user.result.timeline.timeline
  const timeline = select(
    jget(js, "data", "user", "result", "timeline", "timeline"),
    jget(js, "data", "user1", "result", "timeline", "timeline"),
  );
  if (!timeline) return { users, nextCursor };

  const instructions: any[] = jget(timeline, "instructions") ?? [];
  for (const instruction of instructions) {
    if (jstr(instruction, "__typename") === "TimelineAddEntries" || instruction.entries) {
      for (const entry of (instruction.entries ?? [])) {
        const entryId: string = jstr(entry, "entryId");

        // Cursor entries
        if (entryId.startsWith("cursor-bottom") || entryId.startsWith("cursor-showMoreThreads")) {
          const cursorVal = jstr(entry, "content", "value") || jstr(entry, "content", "itemContent", "value");
          if (cursorVal) nextCursor = cursorVal;
          continue;
        }

        // User entries
        const userResult = select(
          jget(entry, "content", "itemContent", "user_results", "result"),
          jget(entry, "content", "content", "itemContent", "user_results", "result"),
        );
        if (userResult) {
          const user = parseGraphUser(userResult);
          if (user.id) users.push(user);
        }
      }
    }
  }

  return { users, nextCursor };
}
