# Paisaxe booking API: Postman collection

`paisaxe-booking.postman_collection.json` walks through the booking journey over HTTP, the same
calls the chat's cards and the booking page make. Fill an environment from
`paisaxe-booking.postman_environment.template.json`; every value in the template is empty and
nothing secret is committed.

**Never run it against production without the owner.** Production has no booking surface for
the public: the `experience_booking` flag is off, and every booking call returns 404.

## What it covers

| Folder | Requests and assertions |
| --- | --- |
| 00 Session | Anonymous Supabase session (Auth REST sign-up with the public anon key; `is_anonymous` is true). *Local only:* seed a fresh and an expired quote for that session |
| 01 Without a voucher | `GET /api/booking/access` and quote acceptance are **404** for a session with no voucher |
| 02 Voucher | `POST /api/booking/voucher/redeem` 200; `GET /api/booking/access` 200, `no-store` |
| 03 Quote acceptance | A stale (expired) quote is **409** `quote_expired`; accepting `quoteId` returns the booking card with the capability link |
| 04 Booking status | `GET /api/booking/bookings/<capability>` 200 `pending_payment` with a live hold, `no-store`, `noindex`. An unknown capability is **404** |
| 05 PayPal deposit | Payment start returns the approval URL. The buyer approves at PayPal (*local only:* the mock's control route). The capture returns `confirmed`, and the status shows the captured payment |
| 06 Cancellation | The preview is read only (the status is unchanged afterwards). A confirm with a higher `expectedRefundCents` is **409** `terms_changed`, and nothing is written. The confirm with the previewed amount refunds it. A second confirm is idempotent, and there is one refund |
| 07 PayPal webhook | Unsigned webhook **401**. *Local only:* the refund event (signed by the mock) is first delivered and processed, the same event is redelivered, and the answer is **200** `duplicate` with the status before and after identical |

Requests marked *Local only* need the local runner. They skip themselves when `localControlUrl`
is empty.

## Variables

| Variable | Where it comes from |
| --- | --- |
| `baseUrl` | The site, e.g. `http://localhost:3006` (the only origin the dev CSRF allowlist accepts) |
| `supabaseUrl`, `supabaseAnonKey` | The project's public Supabase URL and anon key (local: `supabase status`) |
| `voucherCode` | A voucher code from the owner (local: the runner issues one) |
| `quoteId` | The quote card in the booking chat (`quoteId`); the local runner seeds it |
| `staleQuoteId` | An earlier version of a quote the assistant later revised, or any quote after its `expiresAt`. Empty: that request is skipped |
| `localControlUrl` | Local runner only; empty everywhere else |
| everything else | Set by the collection's scripts while it runs |

## The anonymous session

The first request signs up anonymously at Supabase Auth (`POST {{supabaseUrl}}/auth/v1/signup`,
header `apikey: {{supabaseAnonKey}}`, body `{}`). It stores the returned `access_token`, and the
voucher, access and quote calls send it as `Authorization: Bearer {{accessToken}}`. In the
browser the same session lives in the Supabase auth cookie; the server accepts either. The
capability routes (status, payment, capture, cancellation) need no session: the capability
alone authorizes them, and it is stored in `capability` and never logged by the scripts.

## CSRF outside the browser

Every `POST` under `/api/` except `/api/webhooks/` goes through the CSRF proxy. It needs two
things:

1. An `Origin` header from the allowlist. The collection sends `Origin: {{baseUrl}}`, and under
   `next dev` only `http://localhost:3006` is accepted, so run the dev server on port 3006.
2. A double-submit token: the `__csrf` cookie and the `x-csrf-token` header must carry the same
   value. The browser gets the cookie from any page; the collection's pre-request script
   generates a random `csrfToken` and sends it both as `Cookie: __csrf={{csrfToken}}` and as
   `x-csrf-token`.

A wrong origin or a mismatched pair is answered `403` before the route runs.

## The PayPal approval step (interactive against the sandbox)

PayPal needs the buyer to approve the order in a browser. Against the real sandbox:

1. Run the collection up to **05 / Start payment (approval URL)**. The response, and the
   `approveUrl` variable, hold the approval link.
2. Open `approveUrl` in a browser and log in as the **sandbox buyer**, never as a real PayPal
   account. Approve the payment.
3. PayPal redirects to `/booking/<capability>/return?token=<order id>`. The `token` is the order
   id, already stored in `paypalOrderId` from the approval URL. Then run **Capture after
   approval** and continue with the rest of the collection.

If the capture answers `202 awaiting_approval`, the buyer has not approved yet. Against the
sandbox the refund webhook comes from PayPal itself. Test the redelivery with "Resend" on the
sandbox webhook events page and compare the booking status before and after. The local run
does the same with the mock.

## Run it locally (Newman, local Docker, PayPal mock)

Local only: the runner refuses any Supabase, site or PayPal URL that is not loopback. It never
uses `.env.local`, which targets production. Prerequisites: the local Supabase stack is up
(`supabase status`), and `npm install` has been run.

**Terminal 1: the runner.** It starts the PayPal mock on `127.0.0.1:4010` and the control routes
on `127.0.0.1:4011`. It also turns the `experience_booking` flag on in the local database
(development row), re-seeds the fixture experience if a reset lost it, and issues a local
voucher. Then it writes the filled environment to
`$TMPDIR/paisaxe-postman/paisaxe-booking.local.postman_environment.json`, outside the
repository, and stays up until Ctrl-C.

```bash
npx tsx scripts/booking/postman-local.ts
```

**Terminal 2: `next dev` on port 3006 with only local variables.** `env -i` drops everything
else from the shell:

```bash
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
ulimit -n 65536
env -i HOME="$HOME" PATH="$PATH" TMPDIR="$TMPDIR" \
  WATCHPACK_POLLING=true \
  NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
  SUPABASE_SERVICE_KEY="$SERVICE_ROLE_KEY" \
  BOOKING_LINK_SECRET="$(openssl rand -hex 32)" \
  PAYPAL_CLIENT_ID=local-mock PAYPAL_CLIENT_SECRET=local-mock PAYPAL_WEBHOOK_ID=local-mock \
  PAYPAL_API_BASE=http://127.0.0.1:4010 \
  NEXT_PUBLIC_SITE_URL=http://localhost:3006 \
  npx next dev -p 3006
```

**Terminal 3: the collection.** Newman is Postman's open-source command-line runner
(Apache-2.0):

```bash
npx --yes newman@6 run docs/hackathon/postman/paisaxe-booking.postman_collection.json \
  -e "$TMPDIR/paisaxe-postman/paisaxe-booking.local.postman_environment.json"
```

Each run uses a new anonymous session. The runner's voucher allows ten runs, after which you
restart the runner. Afterwards, stop terminals 2 and 1 and restore the file `next dev` rewrites:

```bash
git checkout -- AGENTS.md
```

Notes:

- The mock completes refunds later (`PENDING`). The cancellation therefore ends in
  `refund_pending`, and the mock-signed refund webhook moves it to `refunded`, as a sandbox
  refund that completes asynchronously would.
- Restart `next dev` whenever you restart the runner. The app may hold an OAuth token issued by
  the previous mock, which the new one does not know.
- The runner prints a `net.http_post ... does not exist` WARNING when it switches the flag on.
  It comes from a local database trigger and is harmless.
- The filled environment holds the local voucher code and session tokens. It lives in the temp
  directory only. Do not copy it into the repository.
