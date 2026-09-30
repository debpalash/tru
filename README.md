# Tru

**News. With evidence.**

Tru helps readers follow factual reporting, compare independent sources, and
understand what is known and what remains uncertain. Original publisher links
and headline corroboration sit behind every story’s details. AI assists research
and summaries; its output is grounded in supplied sources and is never treated
as proof.

The app brings news, world reports, Hacker News, authenticated X posts, saved
stories, and topic monitors into one quiet feed.

Live publishers include Hacker News, GitHub Trending, Product Hunt, The Verge, Ars Technica, BBC World, The Hindu, NDTV India, The Indian Express, The Guardian World, and NPR News. The power-user workspace adds native HN threads; verified deep research; local world-event clustering, entities, dossiers, and directional early warning; an offline evidence library/reader; approved media desks; and topic monitors with optional local background notifications. Tru does not manufacture placeholder posts.

Authenticated X support includes the Following timeline; Top, Latest, People, Photos, and Videos search; profile posts, replies, media, and likes; threads; lists and members; bookmarks; native notifications, mentions, and trends; polls and link cards; likes, reposts, replies, quotes, follows, delete, and compose. Messages remain on X's authenticated web surface. Login happens only on X's own page; Tru stores the resulting session cookies in the device keystore.

X media is fail-closed. Parsed photo/video metadata is preserved, but no remote image is painted until a downsized X CDN preview passes the configured Google AI general-audience check; the server keeps classification credentials private. Unsafe, ambiguous, failed, and non-X media stay hidden. Settings can switch between **Safe media** and **Hide all media**. X communities are excluded because their metadata does not expose a dependable adult-content signal.

## Headline evidence

Each story’s details include a headline-evidence score and source links. Citation URLs must use HTTPS and match publisher hosts pinned in the source registry. A single publisher is capped at 60; higher scores require close claim alignment across independent editorial publishers. Developing stories with different numbers, negation, question headlines, or only broad event overlap do not corroborate one another. Smart mix ranks by evidence and collapses matching reports into one cited card; Latest keeps every report.

This score measures publisher provenance and headline-level corroboration. It is deliberately not presented as proof that every statement in the full article is true, and an LLM does not determine the score.

## Live web grounding

Tru uses server-authenticated Firecrawl for explicit web work only. Expanding a card and choosing **Check sources** searches pinned editorial and first-party domains from the past week, then recomputes that card's deterministic headline-evidence score. Asking the agent searches those same domains and extracts at most two top pages before the LLM answers. Every search enables SafeSearch; arbitrary search results cannot become citations.

Normal feed refreshes call publishers directly and spend no Firecrawl credits. The on-device guardrail allows at most 40 credits per UTC day and 400 per UTC month. A search of up to 10 results costs 2 credits and a basic page extraction costs 1. The backend also enforces persistent per-device and global request quotas. If Firecrawl is unavailable, Tru falls back to its loaded feed and says so rather than blocking the app.

## Download

Signed Android builds are available from [GitHub Releases](https://github.com/debpalash/tru/releases).
Choose the **universal APK** if you are unsure of your device's architecture.
Smaller APKs are available for ARM64, ARMv7, x86 and x86_64. Android 7.0 or newer
is required. The AAB is for store distribution, not direct installation.

News feeds work without an AI connection. AI features require a separately
configured private service; no service credentials are bundled. X integration
is experimental and may change with X's web APIs.

## Development

```bash
bun install
bun run typecheck
bun test
bun run android
```

Android application ID: `com.tru.news`.

## AI service and credentials

Provider credentials live only in the server's ignored `.env`. The app contains no
provider keys. Run `bun run server`, issue a device token with `bun run access issue
device-name`, and connect through Settings using your HTTPS service origin and
that token. Questions, source excerpts, and media previews go through this service;
the connection screen explains this before asking for consent.

See [release setup](docs/RELEASE.md), [data practices](docs/PRIVACY.md), and
[third-party notices](THIRD_PARTY_NOTICES.md). The combined source is AGPL-3.0-only.
Hosting an AI service is an optional, separate operator step.

```sh
bun run typecheck
bun test
bun run audit:release
bun run notices
```

The UI uses neutral light/dark/dim surfaces, readable source rows, and an uncluttered
research screen. Tru is an independent project, not affiliated with OpenAI.
