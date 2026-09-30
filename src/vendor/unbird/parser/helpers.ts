// SPDX-License-Identifier: AGPL-3.0-only
// Parser helpers — ported from nitter/src/parserutils.nim
// JSON traversal helpers (replaces Nim's {..} accessor) + shared utilities.

// --- JSON traversal helpers (replaces Nim's {..} accessor) ---

export function jget(obj: any, ...keys: (string | number)[]): any {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

export function jstr(obj: any, ...keys: (string | number)[]): string {
  return String(jget(obj, ...keys) ?? "");
}

export function jint(obj: any, ...keys: (string | number)[]): number {
  const v = jget(obj, ...keys);
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

export function jbool(obj: any, ...keys: (string | number)[]): boolean {
  return !!jget(obj, ...keys);
}

export function select(...nodes: any[]): any {
  for (const n of nodes) {
    if (n != null && n !== undefined) return n;
  }
  return undefined;
}

export function getTypeName(js: any): string {
  return jstr(js, "__typename") || jstr(js, "type");
}

export function getEntryId(e: any): string {
  return jstr(e, "entryId") || jstr(e, "entry_id");
}

export function getImageStr(val: any): string {
  if (typeof val !== "string" || !val) return "";
  // The web frontend strips the CDN domain to route images through its own
  // `/api/image` proxy. The mobile app has no proxy server — it fetches images
  // directly from the CDN — so we must keep ABSOLUTE URLs. X returns these as
  // full https://pbs.twimg.com/... URLs already; only re-absolutize the rare
  // pre-stripped/relative form.
  if (val.startsWith("http")) return val;
  const cleaned = val.replace(/^https?:\/\//, "").replace(/^pbs\.twimg\.com\//, "");
  return `https://pbs.twimg.com/${cleaned}`;
}

export function getId(val: any): string {
  if (val == null) return "";
  const s = String(val);
  const dashIdx = s.lastIndexOf("-");
  return dashIdx >= 0 ? s.slice(dashIdx + 1) : s;
}

export function getTweetResult(js: any, root = "content"): any {
  return select(
    jget(js, root, "content", "tweet_results", "result"),
    jget(js, root, "itemContent", "tweet_results", "result"),
    jget(js, root, "content", "tweetResult", "result")
  );
}

export function getExpandedUrl(js: any, fallback = ""): string {
  return jstr(js, "expanded_url") || jstr(js, "url") || fallback;
}

export function getMp4Resolution(url: string): number {
  const match = url.match(/\/vid\/\d+x(\d+)\//);
  return match ? parseInt(match[1]!, 10) : 0;
}

const TW_MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseTwitterDate(str: string): Date {
  if (!str) return new Date(0);
  // V8/Node parse Twitter's "Wed Oct 10 20:19:24 +0000 2018" format natively,
  // but Hermes (React Native's engine) does NOT — it returns Invalid Date,
  // which previously collapsed every timestamp to the epoch (Jan 1 1970).
  // Parse the canonical Twitter format manually so it works on-device too.
  const m = str.match(
    /^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})\s+(\d{4})$/
  );
  if (m) {
    const [, mon, day, hh, mm, ss, tz, year] = m;
    const month = TW_MONTHS[mon];
    if (month !== undefined) {
      const tzSign = tz[0] === "-" ? -1 : 1;
      const tzOffsetMin =
        tzSign * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
      const utcMs = Date.UTC(
        parseInt(year, 10), month, parseInt(day, 10),
        parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10)
      );
      return new Date(utcMs - tzOffsetMin * 60000);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
