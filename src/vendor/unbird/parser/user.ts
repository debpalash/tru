// SPDX-License-Identifier: AGPL-3.0-only
// User parsers — ported from nitter/src/parser.nim

import type { User } from "../types";
import { VerifiedType, emptyUser } from "../types";
import {
  jget, jstr, jint, jbool, select, getImageStr, getExpandedUrl, parseTwitterDate,
} from "./helpers";

// --- User parser ---

/** Pure: first entry of pinned_tweet_ids_str as a usable id (undefined if none). */
export function firstPinnedId(arr: unknown): string | undefined {
  const v = Array.isArray(arr) ? arr[0] : undefined;
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}

function parseUser(js: any, id = ""): User {
  if (!js) return emptyUser();
  const user: User = {
    id: id || jstr(js, "id_str"),
    username: jstr(js, "screen_name"),
    fullname: jstr(js, "name"),
    location: jstr(js, "location"),
    website: "",
    bio: jstr(js, "description"),
    userPic: getImageStr(jstr(js, "profile_image_url_https")).replace("_normal", ""),
    banner: getBanner(js),
    pinnedTweet: 0,
    following: jint(js, "friends_count"),
    followers: jint(js, "followers_count"),
    tweets: jint(js, "statuses_count"),
    likes: jint(js, "favourites_count"),
    media: jint(js, "media_count"),
    verifiedType: VerifiedType.None,
    protected: jbool(js, "protected") || jbool(js, "privacy", "protected"),
    suspended: false,
    joinDate: parseTwitterDate(jstr(js, "created_at")),
    isFollowing: jbool(js, "following"),
    isMuted: jbool(js, "relationship_perspectives", "muting"),
    isBlocked: jbool(js, "relationship_perspectives", "blocking"),
    pinnedTweetId: firstPinnedId(js?.pinned_tweet_ids_str),
  };
  if (jbool(js, "is_blue_verified")) user.verifiedType = VerifiedType.Blue;
  // Yellow subscription badge (blind field guess: legacy.is_subscription_user);
  // only when nothing stronger applies — fail-soft absence.
  if (user.verifiedType === VerifiedType.None && jbool(js, "is_subscription_user")) user.verifiedType = VerifiedType.Subscriber;
  const vt = jstr(js, "verified_type");
  if (vt && vt in VerifiedType) user.verifiedType = vt as VerifiedType;
  const website = jget(js, "entities", "url", "urls", 0);
  if (website) user.website = getExpandedUrl(website);
  return user;
}

export function parseGraphUser(result: any): User {
  if (!result) return emptyUser();

  // Handle old nitter-style wrapping
  if (result.user_result?.result) result = result.user_result.result;
  else if (result.user_results?.result) result = result.user_results.result;

  const legacy = jget(result, "legacy") ?? {};
  const core = jget(result, "core") ?? {};  // new schema: name/screen_name here
  const profileBio = jget(result, "profile_bio") ?? {}; // new schema: description here
  const avatar = jget(result, "avatar") ?? {};

  // screen_name: core (new) → legacy (old)
  const screenName = jstr(core, "screen_name") || jstr(legacy, "screen_name");
  const fullname = jstr(core, "name") || jstr(legacy, "name");

  // description: profile_bio (new) → legacy (old)
  const bio = jstr(profileBio, "description") || jstr(legacy, "description");

  // profile picture: avatar.image_url (new) → legacy.profile_image_url_https (old)
  const rawPic = jstr(avatar, "image_url") || jstr(legacy, "profile_image_url_https");
  const userPic = getImageStr(rawPic).replace("_normal", "");

  const user: User = {
    id: jstr(result, "rest_id") || jstr(legacy, "id_str"),
    username: screenName,
    fullname,
    location: jstr(legacy, "location"),
    website: "",
    bio,
    userPic,
    banner: getBanner({ ...legacy, profile_banner_url: jstr(legacy, "profile_banner_url") }),
    pinnedTweet: 0,
    following: jint(legacy, "friends_count"),
    followers: jint(legacy, "followers_count"),
    tweets: jint(legacy, "statuses_count"),
    likes: jint(legacy, "favourites_count"),
    media: jint(legacy, "media_count"),
    verifiedType: VerifiedType.None,
    protected: jbool(legacy, "protected") || jbool(result, "privacy", "protected"),
    suspended: jstr(result, "__typename") === "UserUnavailable",
    joinDate: parseTwitterDate(jstr(core, "created_at") || jstr(legacy, "created_at")),
    isFollowing: jbool(legacy, "following") || jbool(result, "relationship_perspectives", "following"),
    isMuted: jbool(result, "relationship_perspectives", "muting"),
    isBlocked: jbool(result, "relationship_perspectives", "blocking"),
    pinnedTweetId: firstPinnedId(legacy?.pinned_tweet_ids_str),
  };

  // Verified type
  if (jbool(result, "is_blue_verified") || jbool(result, "verification", "is_blue_verified")) {
    user.verifiedType = VerifiedType.Blue;
  }
  const vt = jstr(legacy, "verified_type");
  if (vt && vt in VerifiedType) user.verifiedType = vt as VerifiedType;
  if (user.verifiedType === VerifiedType.None && jbool(legacy, "is_subscription_user")) user.verifiedType = VerifiedType.Subscriber;

  // Website from entities
  const website = select(
    jget(profileBio, "entities", "urls", 0),
    jget(legacy, "entities", "url", "urls", 0)
  );
  if (website) user.website = getExpandedUrl(website);

  return user;
}

function getBanner(js: any): string {
  const url = getImageStr(jstr(js, "profile_banner_url"));
  if (url) return url + "/1500x500";
  const color = jstr(js, "profile_link_color");
  if (color) return "#" + color;
  return "";
}
