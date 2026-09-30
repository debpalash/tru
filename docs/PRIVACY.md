# Tru privacy

Tru is free and open source. There are no ads, behavioral analytics, subscription,
remote push service or developer-operated data collection endpoint. Reading news
does not require an account. There is no shared AI backend bundled with the app.

This is not a promise that internet services see no data: publishers, X and an
AI service you explicitly connect receive the requests necessary to serve you.

## What stays on your device

Preferences, saved articles, reader content, drafts, monitor terms and usage
counters remain on the device. X session cookies and service access tokens use
OS secure storage. Android backup is disabled. Region selection uses locale/time
zone or your manual choice; Tru requests no GPS, contacts, microphone or camera
access. Monitor notifications are generated locally through Android’s APIs, with
permission requested only when you enable background alerts. No push token or
Google/Firebase service is used.

## What leaves your device

- Feed publishers and X receive content requests. Without a private route, they
  can see your IP. Visiting an article lets its publisher serve its own webpage;
  that page may have separate cookies, analytics or advertising.
- Optional AI sends questions and selected source excerpts to your chosen
  service and its configured AI providers. Retries can send the same question
  to more than one configured provider.
- Explicit web research sends your query and selected URLs through the service
  to Firecrawl. Regular feed refreshes do not use Firecrawl.
- Safe media sends image previews through your service to Google AI for
  classification. This can include previews from your signed-in X account.
  Hide media stops new checks. Classification can make mistakes and cannot
  establish that a whole video is safe.

Your service and those providers have their own retention and billing policies.
AI is remote and optional; it does not run on-device. Connecting requires
explicit consent in Settings. No provider credentials are bundled in the app.

## Private routes

Tor routes supported API/text requests while it is ready. Native media is blocked
under Tor, including when Relay is enabled; errors never silently fall back to a
direct connection. A public relay sees your IP and requested URLs. Public proxy
operators are independent third parties. An external browser uses its own network
settings. These controls are not a guarantee of anonymity.

## If you host the optional service

The included backend does not log or persist question/image bodies. It stores
hashed access tokens, operator-chosen labels, expiries and quota counters to
authenticate requests and limit abuse. These are access records, not usage
analytics. Reverse proxies and providers may retain logs under their own
configuration. Choose non-personal labels and explain actual retention to users.

## Your controls and support

Disconnect X or the AI service to remove local credentials. Disconnecting X
also clears cookies for Tru’s embedded browser. Delete saved stories and monitor
rules in their screens; clear app storage to remove the remaining local data.
Service access stays valid until expiry or operator revocation. Contact your
chosen service operator for server-record deletion.

Project support: https://github.com/debpalash/tru/issues. Report security concerns
through GitHub’s private vulnerability reporting when available; do not paste
tokens, cookies or personal account data into a public issue.
