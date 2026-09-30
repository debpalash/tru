# Third-party notices

## Unbird / Nitter

`src/vendor/unbird/` contains X protocol definitions and parsers adapted from the
local Unbird project's `mobile/src/engine/` implementation, itself ported from
Nitter. The upstream files declare `SPDX-License-Identifier: AGPL-3.0-only`.
The full license is preserved at `src/vendor/unbird/LICENSE`.

Changes for Tru: copied only the X parsing dependency graph; removed unrelated
media-source helpers and unused consumer/bearer credentials; retained parser
attribution. Public X web authorization is discovered at runtime.

The combined application includes AGPL code. Do not describe the complete app as
MIT or proprietary without separately resolving the upstream rights. Provide
corresponding source with releases and retain these notices. The combined source release uses AGPL-3.0-only, with the full license at `LICENSE`.

## JavaScript and native dependencies

The exact dependency versions are recorded in `bun.lock`. See each installed
package's LICENSE/NOTICE for its terms. Generate a release inventory with
`bun run notices`; the generated inventory lists dependencies and license metadata,
not a replacement for required license texts.

Tru is independent of OpenAI, Google, and X. Their names identify interoperable
services. The interface uses Tru's name and existing icon, not OpenAI branding.

## Embedded Tor and native networking

The Android module includes `info.guardianproject:tor-android:0.4.9.5` and
`info.guardianproject:jtorctl:0.4.5.7`. Their Maven metadata declares BSD-3-Clause;
upstream notices are retained in `licenses/native/` from
https://github.com/guardianproject/tor-android/blob/master/LICENSE and
https://github.com/torproject/jtorctl/blob/master/LICENSE. The upstream Tor Android
notice includes attribution for components from its broader upstream bundle;
this does not imply Tru uses every listed component.

Native networking uses OkHttp 4.9.2 and AndroidX WebKit 1.12.1, distributed under
Apache-2.0. Other Android dependencies remain recorded by Gradle's versioned
build configuration. Include native upstream notices alongside generated
JavaScript notices when distributing binaries.
