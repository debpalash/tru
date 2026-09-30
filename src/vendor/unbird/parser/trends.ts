// SPDX-License-Identifier: AGPL-3.0-only
// Trends parser (1.1/trends/place.json) — ported from nitter/src/parser.nim

import type { Trend } from "../types";
import { jget, jstr, select } from "./helpers";

export function parseTrends(js: any): Trend[] {
  // place.json returns a single-element array: [{ trends: [...], as_of, ... }].
  const block = Array.isArray(js) ? js[0] : select(jget(js, 0), js);
  const raw: any[] = jget(block, "trends") ?? [];
  const out: Trend[] = [];
  for (const t of raw) {
    const name = jstr(t, "name") || jstr(t, "trend_name");
    if (!name) continue;
    const trend: Trend = { name };
    const vol = jget(t, "tweet_volume");
    if (typeof vol === "number") trend.tweetVolume = vol;
    const url = jstr(t, "url");
    if (url) trend.url = url;
    out.push(trend);
  }
  return out;
}
