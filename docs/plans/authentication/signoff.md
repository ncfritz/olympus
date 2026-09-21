# Authentication: functional sign-off

One test plan per flow of [ADR 0018](../../decisions/0018-authentication.md),
used to sign off each phase of the [plan](README.md). Automated tests
cover the logic; these checks prove the flows end to end on the real
pieces: browsers, devices, certificates, nginx, providers.

## Environments

| Id      | Where                                                           | Used from |
| ------- | --------------------------------------------------------------- | --------- |
| **DEV** | the dev compose: API, Hasura, the dev CA, the dev border nginx  | phase 1   |
| **INT** | the Mac Mini and NAS on the LAN, real XCA certificates          | phase 2   |
| **EXT** | outside the LAN (a phone on mobile data, a laptop on a hotspot) | phase 6   |

## Fixtures

| Fixture                      | What                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `user-admin`                 | a user with the `admin` role, linked to a GitHub identity   |
| `user-reader`                | a user with the `reader` role, linked to a Google identity  |
| `user-disabled`              | a disabled user with a linked identity                      |
| `stranger`                   | a provider account linked to no user                        |
| `svc-valid`                  | a service certificate, CN of a real agent, OU `test`        |
| `svc-revoked`, `svc-expired` | service certificates, revoked / expired                     |
| `svc-wrong-ca`               | a certificate for the same CN signed by Olympus **Devices** |
| `dev-valid`                  | a device certificate (`.p12` and iOS profile)               |
| `dev-revoked`, `dev-expired` | device certificates, revoked / expired                      |
| `dev-wrong-ca`               | a certificate signed by Olympus **Services** (an agent's)   |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

Evidence sources: the tester's output (`tools/auth-tester`, the iOS
tester's log), the API log (`auth` decisions with principal and reason),
`/metrics` (`auth_decisions_total`, `http_server_request_duration_seconds`
by `client`), nginx access and error logs, browser dev tools.

---

## F1 — Web sign-in

The site signs a user in through a provider and holds a session.

| Id    | Env | Steps                                                            | Expected                                                                                                  | Evidence                               |
| ----- | --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| F1.1  | INT | As `user-admin`, open `olympus.internal…`, sign in with GitHub   | back on the site, signed in; header shows the user                                                        | screenshot; API log `sign-in … github` |
| F1.2  | INT | Same with Google (`user-reader`) and with Synology SSO           | signed in each time                                                                                       | API log per provider                   |
| F1.3  | INT | Inspect cookies after F1.1                                       | `refresh` cookie: httpOnly, Secure, SameSite=Strict, Path=/api/v1/auth; no token in local/session storage | dev tools                              |
| F1.4  | INT | Sign in as `stranger`                                            | "not allowed" page; no session created                                                                    | API log; `ListSessions` for none       |
| F1.5  | INT | Sign in as `user-disabled`                                       | "not allowed"; no session                                                                                 | API log                                |
| F1.6  | INT | Cancel at the provider's consent screen                          | back on the site signed out, with a message                                                               | screenshot                             |
| F1.7  | DEV | Tamper: change `state` on the callback URL                       | sign-in refused; no token request made                                                                    | browser network log                    |
| F1.8  | DEV | Replay a used authorization code (tester: `login --replay-code`) | `400 invalid_grant`                                                                                       | tester output                          |
| F1.9  | DEV | Exchange a code with the wrong `code_verifier`                   | `400 invalid_grant`                                                                                       | tester output                          |
| F1.10 | DEV | `authorize` with a redirect URI not registered for the client    | `400`, no redirect to it                                                                                  | tester output                          |
| F1.11 | INT | Reload the site after sign-in; open a second tab                 | still signed in (refresh restores the session)                                                            | screenshot                             |
| F1.12 | EXT | F1.1 on `olympus.ncfritz.net` with `dev-valid` installed         | signed in; the provider returned to the public host                                                       | screenshot; NAS access log             |

## F2 — Token refresh

Access tokens expire after 10 minutes; clients refresh without the user
noticing; rotated tokens can't be reused.

| Id   | Env | Steps                                                                  | Expected                                                                            | Evidence                         |
| ---- | --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| F2.1 | INT | Signed in on the site, idle 11 minutes, then navigate                  | page loads; one `401` then a refresh then the retried call succeed                  | network log                      |
| F2.2 | DEV | `tester refresh` twice                                                 | each returns a new refresh token; `sessions` shows one session, `last used` updated | tester output                    |
| F2.3 | DEV | `tester refresh --replay` (the previous token)                         | `401`; the session is revoked; the current token also fails now                     | tester; API log `reuse detected` |
| F2.4 | DEV | Refresh with a token for another client id                             | `401`                                                                               | tester                           |
| F2.5 | DEV | Refresh after the session's 30 days (clock or short test lifetime)     | `401`, sign in again                                                                | tester                           |
| F2.6 | INT | Change `user-reader`'s roles; refresh                                  | the new access token carries the new roles                                          | `tester whoami`                  |
| F2.7 | INT | Disable `user-reader`; refresh                                         | `401`; the site shows signed out                                                    | tester; screenshot               |
| F2.8 | INT | Two tabs refresh at the same moment                                    | both keep working (no false reuse detection)                                        | network log                      |
| F2.9 | DEV | `tester whoami` after sign-in, after a refresh, after signing in again | `auth_time` unchanged by the refresh; a new, later value after the new sign-in      | tester output                    |

F2.8 needs a design answer before phase 3 ends: a short grace window for
the previous token, or the site serializing refreshes across tabs.

## F3 — A user's API request

| Id   | Env | Steps                                                                            | Expected                                                                                      | Evidence           |
| ---- | --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------ |
| F3.1 | INT | Signed in, use pages that read and write (movie, notes, notifications)           | all work                                                                                      | screenshot         |
| F3.2 | INT | `/metrics` after F3.1                                                            | `http_server_request_duration_seconds{client="olympus-site"}` for those operations            | `/metrics` excerpt |
| F3.3 | DEV | `tester call` with no token (report mode)                                        | `200`; API log `would reject: no credentials`; `auth_decisions_total{outcome="would_reject"}` | log; metrics       |
| F3.4 | DEV | Expired token; a token signed by an unknown key; `aud` changed; tampered payload | report: log `would reject` with the reason; enforce: `401`                                    | log                |
| F3.5 | DEV | `user-reader` calls an admin-only operation                                      | report: `would reject: role`; enforce: `403`                                                  | log                |
| F3.6 | DEV | A request to `3100` with `X-Client-Subject` / fake identity headers and no token | treated as anonymous; headers ignored                                                         | log                |
| F3.7 | EXT | F3.1 from outside the LAN                                                        | works; NAS access log shows the device certificate subject                                    | NAS log            |

## F4 — Sign-out and sessions

| Id   | Env | Steps                                                                          | Expected                                                   | Evidence              |
| ---- | --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------- |
| F4.1 | INT | Sign out on the site                                                           | signed out; refresh cookie cleared; the session is revoked | dev tools; `sessions` |
| F4.2 | INT | Signed in on site and tester; list sessions; revoke the site's from the tester | the site is signed out at its next refresh (≤ 10 minutes)  | screenshot; tester    |
| F4.3 | DEV | Use an access token after sign-out, before it expires                          | still accepted until expiry (documented behaviour)         | tester                |
| F4.4 | INT | Revoke all of `user-reader`'s sessions (runbook)                               | every client of that user signed out within 10 minutes     | tester; screenshot    |

## F5 — Mobile sign-in (React Native tester)

Proves the iOS pattern with `apps/auth-tester-mobile` before any app
work (phase 4 internal, phase 6
external).

| Id    | Env | Steps                                                                                               | Expected                                                                                              | Evidence            |
| ----- | --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| F5.1  | INT | Install the tester; sign in with GitHub                                                             | `ASWebAuthenticationSession` opens; returns via `olympus-auth-tester://auth`; claims shown            | screen recording    |
| F5.2  | INT | "Call API"                                                                                          | `DescribeCurrentUser` returns the user; log shows `Bearer`                                            | tester log          |
| F5.3  | INT | Kill and relaunch the app                                                                           | still signed in (refresh token from the Keychain)                                                     | recording           |
| F5.4  | INT | Background the app 11+ minutes, return, "Call API"                                                  | one refresh, then success                                                                             | tester log          |
| F5.5  | INT | "Replay previous refresh token"                                                                     | `401`; session revoked; the app returns to signed out                                                 | tester log          |
| F5.6  | EXT | Profile with `dev-valid` installed; `.p12` **not** imported in the app (`client-identity`); sign in | sign-in page loads through the border (proves `ASWebAuthenticationSession` uses the profile identity) | recording; NAS log  |
| F5.7  | EXT | Continue F5.6: the token exchange                                                                   | fails at the border (proves the app's requests can't use the profile identity)                        | tester log; NAS log |
| F5.8  | EXT | Import `dev-valid.p12` in the app (`client-identity`); repeat                                       | exchange and "Call API" succeed                                                                       | tester log          |
| F5.9  | EXT | No profile, no `.p12`                                                                               | the border refuses the sign-in page                                                                   | screenshot          |
| F5.10 | EXT | `dev-revoked` imported                                                                              | refused at the border                                                                                 | NAS log             |
| F5.11 | INT | Sign out                                                                                            | Keychain cleared; session revoked                                                                     | tester log          |

F5.6 and F5.7 record what iOS does; if F5.6 fails, the fallback
(sign-in in a web view whose requests go through `client-identity`) is decided before the iOS app starts.

## F6 — Agent request (Docker)

| Id   | Env | Steps                                                                                 | Expected                                                                           | Evidence                            |
| ---- | --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| F6.1 | INT | Each agent does its normal work (search, metadata batch, transcode, notification)     | work completes; API log: principal `service/<agent>/mac-mini`                      | API log                             |
| F6.2 | INT | `/metrics`                                                                            | `client` = each agent's CN on its operations; no `unknown`                         | metrics excerpt                     |
| F6.3 | DEV | `tester agent-call` with `svc-revoked`, `svc-expired`, `svc-wrong-ca`, no certificate | TLS handshake fails; no HTTP request logged                                        | tester output; API log (TLS error)  |
| F6.4 | DEV | `svc-valid` with `X-Olympus-Client` of another agent                                  | report: `would reject: client mismatch`; enforce: `401`                            | log                                 |
| F6.5 | DEV | An agent whose CN has no role for an operation                                        | report: `would reject: role`; enforce: `403`                                       | log                                 |
| F6.6 | INT | Revoke `svc-valid`, export the list, wait for reload                                  | new connections refused within a minute, without an API restart                    | tester; API log `CRL reloaded`      |
| F6.7 | INT | Metadata batch run (high volume) for 10 minutes                                       | handshakes ≈ number of connections, not requests; latency unchanged vs before mTLS | metrics (client vs server duration) |
| F6.8 | DEV | An agent calls `3100` (wrong listener)                                                | report: `would reject: no credentials`; enforce: `401`                             | log                                 |

## F7 — Agent request (NAS)

| Id   | Env | Steps                                                                                        | Expected                                                              | Evidence          |
| ---- | --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| F7.1 | INT | The NAS asset agent runs its handlers                                                        | work completes; principal `service/dionysus-asset-agent/nas`          | API log           |
| F7.2 | INT | From the NAS: `openssl s_client -connect api.olympus.internal.ncfritz.net:3443` with no cert | handshake fails                                                       | terminal output   |
| F7.3 | INT | The server certificate the NAS sees                                                          | names `api.olympus.internal.ncfritz.net`; chains to the internal root | `s_client` output |
| F7.4 | INT | Revoke the NAS certificate only                                                              | the NAS agent is refused; the Mac Mini asset agent keeps working      | API log           |
| F7.5 | INT | From another LAN machine, `curl http://<mac-mini>:3100`                                      | connection refused (3100 not published)                               | terminal output   |

## F8 — Certificate issuance and revocation

| Id   | Env | Steps                                                                                                               | Expected                                                                | Evidence          |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| F8.1 | INT | Issue a service certificate by the runbook; install; restart the agent                                              | F6.1 passes for it                                                      | runbook checklist |
| F8.2 | INT | Issue a device certificate with its key generated (escrowed in XCA); install on iPhone (profile) and Mac (keychain) | F5.6 / F9.1 pass for it; the key can be exported again from XCA         | runbook checklist |
| F8.3 | INT | Revoke both by the runbook; export both lists                                                                       | F6.6 and F9.3 behaviour                                                 | runbook checklist |
| F8.4 | INT | Let a revocation list pass its next-update date (test list with a short lifetime)                                   | documented behaviour: nginx and the API refuse; alert noted for runbook | logs              |

## F9 — The border (device certificates)

| Id   | Env | Steps                                                                              | Expected                                      | Evidence              |
| ---- | --- | ---------------------------------------------------------------------------------- | --------------------------------------------- | --------------------- |
| F9.1 | EXT | Browser with `dev-valid` opens `olympus.ncfritz.net`                               | asked for the certificate; site loads         | screenshot; NAS log   |
| F9.2 | EXT | Browser without a certificate                                                      | refused (no site content served)              | screenshot            |
| F9.3 | EXT | `dev-revoked`, `dev-expired`, `dev-wrong-ca`                                       | refused                                       | NAS log               |
| F9.4 | INT | On the LAN, `olympus.ncfritz.net` resolves to the NAS and asks for the certificate | same as outside                               | `dig`; screenshot     |
| F9.5 | EXT | Server certificate of both public names                                            | Let's Encrypt, valid, names match             | browser               |
| F9.6 | EXT | Cloudflare record for both names                                                   | DNS only (grey cloud); resolves to the router | Cloudflare screenshot |
| F9.7 | EXT | `api.olympus.ncfritz.net:3443` and `:3100`                                         | not reachable from outside                    | port check            |

## F10 — Notifications (Socket.IO)

| Id    | Env | Steps                                                                 | Expected                                                       | Evidence    |
| ----- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| F10.1 | INT | Signed in on the site; trigger a notification (SendNotification test) | the toast appears                                              | screenshot  |
| F10.2 | DEV | Connect the socket with no token / an expired token                   | report: logged; enforce: connection refused                    | log         |
| F10.3 | INT | Stay connected past token expiry                                      | documented behaviour (reconnect with a fresh token on refresh) | network log |

## F11 — Report mode

| Id    | Env | Steps                                                | Expected                                                               | Evidence |
| ----- | --- | ---------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| F11.1 | DEV | Every negative case of F3, F6 and F10 in report mode | nothing rejected; each logged once with principal (if any) and reason  | log      |
| F11.2 | DEV | `/metrics`                                           | `auth_decisions_total` by listener, outcome and reason matches the log | metrics  |

## F12 — Signing key rotation

| Id    | Env | Steps                                 | Expected                                                                      | Evidence       |
| ----- | --- | ------------------------------------- | ----------------------------------------------------------------------------- | -------------- |
| F12.1 | INT | Add a new key by the runbook; restart | `jwks.json` lists both; new tokens carry the new `kid`; old tokens still pass | `curl`; tester |
| F12.2 | INT | After 10 minutes, retire the old key  | `jwks.json` lists one; nothing signed in is affected                          | tester         |
| F12.3 | DEV | A token with a retired `kid`          | rejected                                                                      | tester         |

## F13 — Enforcement

Run after switching each listener to `enforce` (phase 8).

| Id    | Env      | Steps                                                       | Expected                                       | Evidence     |
| ----- | -------- | ----------------------------------------------------------- | ---------------------------------------------- | ------------ |
| F13.1 | INT      | Repeat F3.3–F3.6, F6.3–F6.5, F6.8, F10.2 against production | `401` / `403` / handshake failure as specified | tester; logs |
| F13.2 | INT, EXT | Repeat F1.1, F3.1, F5.2, F6.1, F7.1                         | still pass                                     | as the cases |
| F13.3 | INT      | Report log for the previous 24 hours                        | no rejections of legitimate callers            | log          |
| F13.4 | INT      | Roll back one listener to `report`; confirm; re-enforce     | switch works without a code change             | log          |

## Sign-off matrix

| Phase | Flows to pass                                                                 |
| ----- | ----------------------------------------------------------------------------- |
| 1     | F6.3–F6.5, F6.8 (DEV), F11                                                    |
| 2     | F6, F7, F8.1, F8.3 (services)                                                 |
| 3     | F1.7–F1.10, F2.2–F2.5, F2.9, F3.3–F3.6, F4.3, F12.3 with the CLI tester (DEV) |
| 4     | F5.1–F5.5, F5.11 (INT, dev border)                                            |
| 5     | F1 (INT), F2, F3 (INT), F4, F10                                               |
| 6     | F9, F5.6–F5.10, F1.12, F3.7, F8.2                                             |
| 7     | F12, F8.4                                                                     |
| 8     | F13                                                                           |
