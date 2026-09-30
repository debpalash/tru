// SPDX-License-Identifier: AGPL-3.0-only
// Direct Message parsers (1.1 REST) — ported from nitter/src/parser.nim
//
// The DM endpoints return X's classic v1.1 "entries/conversations/users" shape,
// NOT the GraphQL tweet graph — so these parsers are self-contained and never
// touch parseGraphTweet. Written defensively against several observed field
// spellings; degrade to empty on anything unexpected (fail-soft). The exact
// wire shape needs on-device confirmation — see api.ts getDmInbox notes.

import type { DmConversation, DmMessage } from "../types";
import { jget, jstr, jint, select, getImageStr } from "./helpers";

function dmMessageFrom(entry: any): { msg: any; convId: string } | null {
  // An inbox/conversation "entry" wraps the actual event under `message`,
  // (occasionally `message_create` on older shapes). Only message events carry
  // renderable text; join/leave/reaction events are skipped by the caller.
  const m = select(jget(entry, "message"), jget(entry, "message_create"));
  if (!m) return null;
  return { msg: m, convId: jstr(m, "conversation_id") };
}

function dmMediaUrl(messageData: any): string {
  const media = jget(messageData, "attachment", "media");
  if (!media) return "";
  // photo → media_url_https; video/gif → best variant or the still.
  const still = getImageStr(jstr(media, "media_url_https"));
  const variants: any[] = jget(media, "video_info", "variants") ?? [];
  let best = "";
  let bestBr = -1;
  for (const v of variants) {
    const br = jint(v, "bitrate");
    if (typeof jget(v, "url") === "string" && br >= bestBr) { best = jstr(v, "url"); bestBr = br; }
  }
  return best || still;
}

export function parseDmInbox(js: any): { conversations: DmConversation[]; cursor: string } {
  const conversations: DmConversation[] = [];
  // inbox_initial_state.json nests under `inbox_initial_state`; the trusted-
  // inbox paginated feed (dm/inbox_timeline/trusted.json) nests under
  // `inbox_timeline`. Accept either.
  const root = select(jget(js, "inbox_initial_state"), jget(js, "inbox_timeline"), js) ?? {};
  const convMap: any = jget(root, "conversations") ?? {};
  const entries: any[] = jget(root, "entries") ?? [];

  // Newest message text per conversation (entries are chronological; keep the
  // one with the highest sort_timestamp / id).
  const lastByConv: Record<string, { text: string; time: number }> = {};
  for (const entry of entries) {
    const parsed = dmMessageFrom(entry);
    if (!parsed || !parsed.convId) continue;
    const text = jstr(parsed.msg, "message_data", "text");
    const t = jint(parsed.msg, "time") || jint(parsed.msg, "id");
    const prev = lastByConv[parsed.convId];
    if (!prev || t >= prev.time) lastByConv[parsed.convId] = { text, time: t };
  }

  for (const convId of Object.keys(convMap)) {
    const c = convMap[convId];
    if (!c) continue;
    const participants: string[] = [];
    for (const p of (jget(c, "participants") ?? [])) {
      const uid = jstr(p, "user_id");
      if (uid) participants.push(uid);
    }
    const last = lastByConv[convId];
    // Unread when the last read event trails the newest event in the thread.
    const lastRead = jstr(c, "last_read_event_id");
    const maxEntry = jstr(c, "max_entry_id") || jstr(c, "sort_event_id");
    const unread = !!maxEntry && !!lastRead && maxEntry > lastRead;
    const sortTs = jint(c, "sort_timestamp") || (last?.time ?? 0);
    conversations.push({
      id: convId,
      participants,
      lastText: last?.text ?? "",
      time: sortTs ? new Date(sortTs) : new Date(),
      unread,
    });
  }

  // Sort newest-first for the inbox list.
  conversations.sort((a, b) => b.time.getTime() - a.time.getTime());
  const cursor = jstr(root, "cursor") || jstr(root, "min_entry_id");
  return { conversations, cursor };
}

export function parseDmConversation(js: any): { messages: DmMessage[]; cursor: string } {
  const messages: DmMessage[] = [];
  const root = select(jget(js, "conversation_timeline"), jget(js, "inbox_initial_state"), js) ?? {};
  const entries: any[] = jget(root, "entries") ?? [];
  for (const entry of entries) {
    const parsed = dmMessageFrom(entry);
    if (!parsed) continue;
    const md = jget(parsed.msg, "message_data") ?? parsed.msg;
    const id = jstr(parsed.msg, "id");
    if (!id) continue;
    const media = dmMediaUrl(md);
    const time = jint(parsed.msg, "time");
    const dm: DmMessage = {
      id,
      conversationId: parsed.convId,
      senderId: jstr(md, "sender_id") || jstr(parsed.msg, "sender_id"),
      text: jstr(md, "text"),
      time: time ? new Date(time) : new Date(),
    };
    if (media) dm.mediaUrl = media;
    messages.push(dm);
  }
  // Oldest-first (chat order).
  messages.sort((a, b) => a.time.getTime() - b.time.getTime());
  const cursor = jstr(root, "min_entry_id");
  return { messages, cursor };
}
