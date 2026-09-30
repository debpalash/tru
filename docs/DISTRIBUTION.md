# Distribution

Tru's official source and signed binaries are hosted on
[GitHub](https://github.com/debpalash/tru). Catalog submissions do not move the
project or change its license.

## Install and update

Use [GitHub Releases](https://github.com/debpalash/tru/releases). Build 2 keeps
Android version `1.0.0`, increments `versionCode` to `2`, and uses the existing
production signing identity. The `v1.0.0-r2` tag identifies this branding revision;
the original `v1.0.0` tag and its downloads remain available. Android builds are
published as previews while experimental X and private-route integrations need
further testing.

The release includes universal, ARM64, ARMv7, x86 and x86_64 APKs, an AAB,
matching source, licenses, checksums, signature verification and a media bundle.

### Obtainium

Add `https://github.com/debpalash/tru` in Obtainium, enable **Include prereleases**,
set release sorting to **Release date**, and set **APK filter by regular
expression** to `universal\.apk$`. This selects
one compatible APK from the five architecture variants. The universal APK is
larger; manual downloads offer smaller device-specific builds.

The import configuration is [distribution/obtainium.json](../distribution/obtainium.json).
The proposed catalog entry is in
[distribution/obtainium-catalog.json](../distribution/obtainium-catalog.json).

## Catalog requests

Requests are reviewed by independent maintainers. A submitted request is not
an accepted listing. Track GitHub requests through the links in release notes;
this project does not display an acceptance badge before approval.

| Channel | Status and requirements |
| --- | --- |
| GitHub Releases | Official signed downloads |
| Obtainium config catalog | GitHub contribution prepared; supports official GitHub releases |
| android-foss | GitHub contribution prepared for RSS Readers |
| F-Droid | Request prepared; official tracker requires GitLab sign-in and build review |
| IzzyOnDroid | Ineligible under its current LLM and AI-authored-code policy; not submitted |
| OpenAPK | Form requires a maintainer name and verification email before submission |

F-Droid's [official requests tracker](https://gitlab.com/fdroid/rfp) is on GitLab.
That is a submission portal, not Tru's source host. The complete request is
[distribution/fdroid-request.md](../distribution/fdroid-request.md). The app has
no Firebase or Play Services dependency. F-Droid still needs to review the
Expo/Bun toolchain and the source-build requirements of the embedded Tor library.
An unsigned Gradle build option exists for independent store signing; see
[release instructions](RELEASE.md).

IzzyOnDroid's [inclusion policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/)
rejects apps integrating LLMs or containing AI-authored code. Tru openly includes
optional AI and uses AI-assisted development, so a submission would conflict with
that policy. The APKs also exceed its usual 30 MB size limit.

OpenAPK's [submission form](https://www.openapk.net/submitapp) requires an email
verification step. No maintainer contact is fabricated for submission.

## Store metadata

Fastlane metadata is under `fastlane/metadata/android/en-US/`: descriptions,
build-2 changelog, icon, feature graphic and real phone screenshots. The original
captures and video/GIF demonstrations are in `docs/screenshots/` and `docs/demos/`.
These captures use public news on an isolated emulator without personal accounts.

Optional remote AI and publisher/X connections must be disclosed in listings.
The app has no Tru subscription, ads or telemetry. Services chosen by a reader
and their providers retain their own policies and may charge for API usage.
