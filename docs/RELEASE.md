# Release preparation

## Backend

Run from the project root:

```sh
bun install --frozen-lockfile
# Fill server-only values in .env (the existing local file is preserved).
bun run server
bun run access issue device-name
```

The server binds only to 127.0.0.1:8788. Put an HTTPS reverse proxy in front, with
request-body limits of 6 MB, connection limits, a 30-second upstream timeout, and
access logging configured to omit authorization headers and request bodies.
Persist `.local/access.sqlite` and its WAL on one instance. Do not run independent
replicas with separate quota databases. Backups contain authentication records
and must remain private. The `.local/device-name.token` file contains a 30-day
access token. Deliver it privately, enter it in Settings with the HTTPS origin,
then remove that delivery file. Never put it in app source or a build variable.

`bun run access revoke device-name` invalidates all tokens with that label.
The app can forget its local connection; server revocation is a separate action.
Expired counters are removed on the next quota check. Token records remain until revoked; use labels
that do not contain personal information.

Limits: 30 usage units per token per minute, 300 per token per UTC day, 3,000 for
the service per UTC day. Media costs two units; other requests cost one. Each AI
call has a 1,200-output-token cap. Limits persist across process restarts. They
bound requests, not dollar spend; configure provider billing controls separately.
No public signup or payment flow is included: this is an operator-issued access
model. No backend has been deployed by these changes.

## Container deployment

`Dockerfile` contains server code only; `.dockerignore` excludes credentials.
`docker compose up -d --build` loads the private `.env` at runtime, keeps the API
bound to localhost on the host, and persists access state in a dedicated volume.
Put the HTTPS reverse proxy in front as described above. Issue/revoke credentials
in the running container with `docker compose exec api bun server/access.ts issue
device-name` (or `revoke`). Token files stay in the private volume; transfer them
through a private channel. Do not delete the volume on restart.

Set `TRU_DISABLED_PROVIDERS` to a comma-separated list of provider IDs to
hide broken or unpaid providers from clients and reject their calls server-side.
Disabling `gemini` also disables media classification; previews stay covered.
`bun run release:probe` performs small real AI requests using server credentials
and reports only success/status, never keys or upstream error bodies. This uses
provider quota. Web and media need separate end-to-end checks.

## Android

Release builds require these environment variables and fail if any are missing:

- `TRU_RELEASE_STORE_FILE`: path to a production keystore outside the source tree
- `TRU_RELEASE_STORE_PASSWORD`
- `TRU_RELEASE_KEY_ALIAS`
- `TRU_RELEASE_KEY_PASSWORD`

Keep production signing material in your release secret store. Development uses
the Android SDK's local debug key; no keystore is distributed. `bun run android:release` builds a signed APK
once those variables are configured; use `:app:bundleRelease` for an AAB.
For a new app with no existing signing identity, explicitly select a new key:

```sh
python3 scripts/create-signing-key.py --new-key
bun run release:build
bun run release:package
```

The generator writes the keystore and private `signing.env` under ignored
`.local/signing/`, owner-only. Back up both privately before publication; they
must never enter source archives or release attachments. Existing apps must use
their existing identity. `release:build` also accepts the signing environment
variables above and does not replace them with local defaults. It includes
license notices, builds APK and AAB, and scans both for credentials. Artifacts
are written under `.local/release/`. The build includes a universal APK and
separate arm64-v8a, armeabi-v7a, x86 and x86_64 APKs, plus the store AAB.
No production signing key is generated or selected automatically.

`release:package` verifies the signer and architecture variants, creates the
matching source archive and public media bundle, combines third-party notices,
audits every attachment, and writes SHA-256 checksums. Keep private signing files
out of uploads; attach only the packaged files under `.local/release/`.

Independent stores can explicitly build an unsigned universal APK for their own
signing pipeline without access to the developer's signing identity:

```sh
EXPO_NO_DOTENV=1 ./android/gradlew -p android :app:assembleRelease \
  -PtruUnsignedRelease=true --console=plain
```

This opt-in flag leaves the APK unsigned. Official GitHub release scripts always
require and verify the production signer. Independent signatures cannot update
GitHub-signed installations in place. See [distribution notes](DISTRIBUTION.md)
for the F-Droid dependency-build review still needed.

## Verification

```sh
bun run typecheck
bun test
bun run audit:release
EXPO_NO_DOTENV=1 bunx expo export --platform android --output-dir /tmp/tru-export
python3 scripts/audit-release.py /tmp/tru-export
```

Also scan the final APK/AAB with the audit script. It inspects archive entries
without printing credentials. Revoke provider keys if old keyed builds were
shared. `.gitignore` is not an archive filter: never ship `.env`, `.local`, caches,
signing files, or debug exports. Server source is safe to publish; server state is not.

Exercise Today, Ask, Settings, X login/logout, hidden media, Tor + Relay, offline
recovery, and 130% text size on a device. Verify logout across a full restart.
External X web APIs remain subject to upstream changes; test a real account
without checking its cookies or credentials into fixtures.

## GitHub publication

Direct APK releases are published with matching source, license notices and
SHA-256 checksums at https://github.com/debpalash/tru/releases. The public source
contains no service credentials, signing identity or local account data.
Use https://github.com/debpalash/tru/issues for support. Reading public news
does not require a hosted AI service. Configure a private service in Settings
to use AI; protected media remains hidden when classification is unavailable.

## Hosted service or store publication

Before publishing a hosted service or submitting to a store, supply the service domain, production signing
credentials, privacy/support contact, and hosted privacy/source URLs. Review
`docs/PRIVACY.md` against the actual host and provider retention configuration.
Publish the matching AGPL-3.0-only source with releases and retain the upstream
notices described in `THIRD_PARTY_NOTICES.md`. The in-app privacy page describes implemented data flows but does
not invent an operator identity or promise upstream deletion.
