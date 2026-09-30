# Public content relay

Only GET/HEAD requests to explicitly listed hosts are accepted. Redirects are
revalidated, credentials are not forwarded, responses are capped at 8 MiB, and
upstream requests time out after 15 seconds. Oversized media fails closed.

`wrangler.toml` configures 60 requests/minute/IP through `RATE_LIMITER`. The worker
returns 503 if the binding is missing. Use a namespace ID unique to your account.
Cloudflare counters are local to each edge location and are not a global billing
cap. Shared IPs can share an allowance. Configure platform spending controls.
See [Cloudflare rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Add exact publisher/CDN hosts to `ALLOWED_HOSTS` only after review. This is an
anonymous, restricted public-content relay, not the authenticated AI service.
Never send account URLs containing secrets through it. Tor mode blocks native
media even when this relay is enabled. Nothing here has been deployed automatically.
