# F-Droid request: Tru

Prepared for https://gitlab.com/fdroid/rfp/-/issues/new. Not submitted or accepted.

## App information

- **Name:** Tru
- **Package:** com.tru.news
- **License:** AGPL-3.0-only
- **Category:** Internet / news reader
- **Source:** https://github.com/debpalash/tru
- **Release:** https://github.com/debpalash/tru/releases/tag/v1.0.0-r2
- **Source revision:** v1.0.0-r2
- **Android version:** 1.0.0 (versionCode 2), Android 7.0+
- **Issue tracker:** https://github.com/debpalash/tru/issues
- **Privacy:** https://github.com/debpalash/tru/blob/main/docs/PRIVACY.md
- **Metadata:** fastlane/metadata/android/en-US/

Tru is a free, open-source news reader built around original publisher links,
independent coverage and optional AI research with citations. Reading news does
not require an account or an AI subscription. Stories, preferences and topic
monitors are stored locally. There are no ads, analytics or developer-operated
collection endpoints. The optional AI service is open source and self-hostable;
users supply their own service connection, and provider keys stay server-side.

## Dependencies and disclosures

The app uses React Native, Expo and an embedded Tor library. Local notifications
use Android APIs through a source module in modules/local-alerts. Firebase,
Google Play Services and remote push registration are absent from build 2.
Automated artifact checks reject Firebase/Play Services DEX descriptors.

Publisher feeds and optional X access require remote services. Optional AI can
use non-free provider networks selected by the service operator. Please review
whether NonFreeNet applies. Tor/relay routing has documented limits; anonymity
is not guaranteed. Development uses AI assistance.

## Build review requested

The public tree includes native Android sources, a frozen Bun lockfile and all
local native modules. Suggested starting toolchain: Bun 1.4.0, JDK 17, Android
SDK 36, NDK version selected by Expo's Gradle plugin. Install with
`bun install --frozen-lockfile`. The unsigned build entry point is:

```sh
EXPO_NO_DOTENV=1 ./android/gradlew -p android :app:assembleRelease \
  -PtruUnsignedRelease=true --console=plain
```

This produces an unsigned universal APK in android/app/build/outputs/apk/release/.
Private keystores and environment files are not included. F-Droid supplies its
own signing identity; its APKs would not replace GitHub-signed APKs in place.

This is a starting build plan, not a validated fdroiddata recipe. The Guardian
Project Tor dependency is fetched from its Maven repository; F-Droid may require
building that dependency from upstream source through srclibs. The Bun bootstrap,
Expo/React Native native dependencies and network-free build preparation also
need maintainer review. Please help identify the appropriate source-build recipe.
