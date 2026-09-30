# Tru data practices

This document describes the GitHub Android release. Project support is available
at https://github.com/debpalash/tru/issues. No shared AI service is bundled with
the app. If you connect a private service, its operator must provide their own
privacy contact, service address and hosting/provider retention details.

Tru stores preferences, saved articles, drafts, monitor terms and usage
counters on-device. X cookies and the service token use OS secure storage. Region
selection uses device locale/time zone or a manual choice, not GPS.

Feed publishers and X receive content requests. AI questions and selected source
excerpts go through the connected Tru service to configured providers
(Google AI, Groq, Cerebras, OpenRouter, or NVIDIA); retries may send the same
request to more than one. Research sends queries and selected URLs to Firecrawl.
Safe media sends image previews, potentially from an authenticated feed, through
the service to Google AI. Hide media stops new preview checks. Classification
can make mistakes and does not establish that an entire video is safe.

The shipped backend deliberately does not log or persist question/image bodies.
It stores token hashes, device labels, expiries, and quota counters. A host, reverse
proxy or upstream provider may retain other logs according to its configuration
and terms. Do not claim these services have zero retention without verifying it.

Without a private route, content hosts see the device IP. A public relay sees
requested URLs and the connecting IP. Native media is blocked under embedded Tor,
including when Relay is also enabled. An external browser has its own routing.

Disconnect removes local credentials. Disconnecting X also clears cookies for Tru’s embedded browser, signing out other websites opened there. Server access remains valid until expiry
or operator revocation. Saved stories/monitors can be removed in-app; clearing
app storage removes other local data. Contact the service operator for server-side
record deletion. No operator email or address is hardcoded in this source.
