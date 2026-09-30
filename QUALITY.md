# Tru quality and release checks

Tru prioritizes source clarity, reliable behavior, and a quiet interface. The checks below record implementation and validation; earlier entries retain their historical context.

## Scorecard

| Area | Weight | Full-credit evidence |
| --- | ---: | --- |
| Design system | 15 | Every shipped screen uses semantic theme, type, spacing, radius and control primitives. No screen invents a parallel palette. |
| Navigation | 15 | Five persistent native tabs, independent X stack, predictable back behavior, tab reset, safe areas and deep links. |
| Feed and posts | 20 | Virtualized heterogeneous rows, stable callbacks, readable hierarchy, evidence disclosure, complete loading/error/empty/end states. |
| Media and composer | 15 | Correct aspect ratios, progressive states, image/video viewer, keyboard-safe composition, drafts and mutation feedback. |
| Accessibility | 15 | 44pt/48dp targets, AA contrast, font scaling, TalkBack labels/state/actions, reduced motion and no color-only meaning. |
| Platform polish | 10 | Light, dark and dim themes, Android and iOS conventions, haptics, keyboard handling and responsive layouts. |
| Verification | 10 | Unit and integration tests plus hands-on navigation checks at default and large font scales with clean runtime logs. |

## Release blockers

- Any dead or misleading control.
- Any body text below 13sp or metadata below 11sp.
- Any interactive target below 44pt on iOS or 48dp on Android without an equivalent hit box.
- Any clipped content, unreachable final row or broken large-text layout.
- Any screen-local decorative palette that conflicts with the theme.
- Any fabricated source, claim, metric or state.
- Any changed primary flow not exercised on the emulator.

## Design decisions

- Color: neutral paper and midnight surfaces keep source content dominant; blue marks navigation and primary action only.
- Layout: flat rows maximize scan density while dividers preserve grouping without card clutter.
- Typography: the native system face preserves platform familiarity; a six-step scale prevents unreadably small local styles.
- Spacing: a 4dp base creates repeatable rhythm; visual density comes from structure, never smaller targets or text.
- Cards: reserved for temporary findings and blocking states because those layers sit above the continuous feed.
- Motion: short transform and opacity feedback confirms interaction; reduced-motion users receive immediate state changes.

## Historical checks on 2026-08-28 (not current release certification)

- TypeScript checks pass for the app and Node configuration.
- All 20 unit and integration tests pass across news, evidence, Firecrawl guardrails and X behavior.
- The accessibility audit reports no unlabeled `PressableScale` or `TextInput` controls and no type below 11sp.
- Light, dark, dim and system appearance were exercised on `emulator-5554`; default and 130% font scales remained usable without clipped primary controls.
- Today, X, Ask, Monitors, More and their secondary routes were navigated on-device, including loading, empty, error, media, evidence, browser and reader states.
- Expo's production Android export completes with 2,352 modules, 28 assets and a 5.3 MB Hermes bundle; the export footprint is 6.5 MB.
- Native Android `assembleDebug` completes and produces `app-debug.apk`.
- Live provider probes succeeded for Gemini, OpenRouter and NVIDIA NIM. Cerebras accurately reports HTTP 402, and Groq accurately reports a missing environment key.
- Firecrawl keyless requests are implemented with a local quota and publisher allowlist. This machine's public IP receives Firecrawl HTTP 403, which NewsPal surfaces as `Network blocked` while direct sources continue to work.

## 2026-09-29 launch hardening and compact UI

- TypeScript checks pass for app and server; 32 tests pass (session deletion,
  service authentication/quotas/validation, relay boundaries, privacy routing,
  source filtering and research behavior).
- Android arm64 debug build succeeds. Release task rejects missing production
  signing configuration as intended.
- Android production export succeeds; credential audit passes against the final
  bundle, including exact local provider credential values (never printed).
- Device review: compact Settings in Dim and Light; Ask with System theme.
  Prior Today/Settings review included 130% text. System theme and 100% text
  restored after checks. Shared headers retain 48dp Android controls.
- Live authenticated X and deployed AI calls remain unverified. Production
  hosting, signing and publication identity requirements are in docs/RELEASE.md.

## 2026-09-29 continued UI polish

- Tightened copy and aligned gutters in Library, Media, Sources, Region, World,
  Reader and More. Removed duplicate Ask navigation from More.
- Media distinguishes loading from empty results and supports refresh; World
  has actionable empty states; Region reports searches with no matches.
- Ask updates its question and clears prior results when opened from another
  page. Reader actions wrap on narrow displays. Back falls back to Today when
  navigation history is unavailable.
- Monitors uses a native switch and reports failed edits. Failed storage writes
  preserve the previous saved state; regression test covers failure and retry.
- App/server type checks pass; 33 tests pass. Android production export and
  credential scan pass. Media and Monitors visually checked on Android using
  the System dark theme; no clipping observed in those views.

## 2026-09-29 minimal Today feed

- Story rows show only publisher, time and headline. Summaries, media, evidence,
  sources and Save/Ask/Check actions open through the details control.
- Removed duplicate always-visible brief, badges and citation bars. Brief opens
  on request; sorting moved out of the category bar. Details reset when a row
  is recycled for another story.
- Android device checks: loaded headline feed, expanded details, save state and
  removal verified. The temporary saved story was removed after verification.
- Type checks and 33 tests pass; production Android export and credential scan
  pass for the final Today changes.

## 2026-09-30 release preparation

- App/server type checks and 35 tests pass, including disabled-provider controls
  and duplicate access-token issuance. Server boot/health/auth smoke check passes.
- Full APK and AAB release-mode builds succeed for arm64-v8a, armeabi-v7a, x86
  and x86_64, targeting Android SDK 36. APK/AAB signatures verify; both pass the
  credential audit. These validation binaries use a two-day QA identity and
  must not be published. Production signing remains an operator choice.
- Added private signing/build tooling, source ZIP packaging, license assets,
  and a Docker/Compose deployment definition. Docker runtime verification is
  pending because the local Docker daemon is unavailable. Backend remains local.
- Live synthetic AI checks: OpenRouter and NVIDIA pass. Google AI key is invalid;
  Cerebras returns HTTP 402 even with a currently available model. Firecrawl is
  unconfigured. Provider disable controls are implemented but the operator's
  release choice remains pending. Ask now labels its feed-only fallback.
- Production publication destination, public operator/contact, hosting, signing
  identity and authenticated-X release testing remain unresolved. No publication
  has occurred during this preparation.

## 2026-09-30 Tru rename

- Renamed the product to Tru with the tagline “News. With evidence.” App metadata,
  UI copy, launcher/splash/notification assets, documentation, server settings,
  relay headers and release filenames use the new name.
- New pre-publication identity: Android/iOS com.tru.news; deep-link scheme tru.
  Private runtime settings use TRU_ prefixes. The prior NewsPal app remains a
  separate installed identity; existing device data was not removed or copied.
- Added reproducible vector-to-raster brand asset tooling and Android adaptive
  launcher resources. Source archive is tru-1.0.0-source.zip.
- Type checks, frozen dependency install and all 35 tests pass. Full APK/AAB
  validation builds succeed on all four ABIs and pass credential scans.
- Installed the temporary-key release validation APK on Android, opened the
  tru://more deep link, and visually verified the Tru heading/tagline. No crash
  or React Native JS error appeared during the checked session.
- These binaries use a temporary QA signing key and are not publication assets.
  Production publication is still pending the operator's previously requested
  destination, contact/hosting details, provider configuration and signing choice.

## 2026-09-30 GitHub Android preview

- Selected a new long-lived production signing identity for this previously
  unpublished application. Signing files and their owner-only backup remain
  private and outside the distributable source.
- Built a universal APK, four individual ABI APKs and an AAB. All production
  signatures and architecture sets verify; APKs share the selected signing key.
- Removed the remaining hardcoded X public bearer from proxy discovery. Its
  probe now uses an unauthenticated X public page; DM filtering is enabled.
- Excluded even the standard development keystore from public source. Debug
  builds use the Android SDK's locally generated identity.
- Strengthened scans for provider/GitHub/cloud tokens, private archive entries,
  signing passwords and local build paths. Native compiler prefix maps remove
  the builder's username/workspace from embedded assertion paths. All final
  binaries pass. Distributable media consists only of brand assets.
- Application/server type checks and 38 tests pass, including archive, token
  redaction and private-path release-audit regressions.
- GitHub destination: debpalash/tru, tag v1.0.0. This is an Android preview,
  not store certification. Public feeds need no AI service; private AI hosting
  is optional. Authenticated X flows remain experimental and not certified.
