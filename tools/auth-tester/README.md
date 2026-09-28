# @ncfritz/olympus-auth-tester

The sign-in flows from a terminal: phase 4 of
[the authentication plan](../../docs/plans/authentication/README.md), and the
scripted half of its sign-off.

It is a real client rather than a script that pokes the endpoints —
authorization code with PKCE, an RFC 8252 loopback redirect, tokens in a
mode-600 file, a refresh when the access token has run out, and every call
through `@ncfritz/olympus-client` with its `auth` option. That is the point:
the flows are proved by something that implements them the way an app has to,
before a site or an iOS app depends on them.

```sh
pnpm --filter @ncfritz/olympus-auth-tester build
pnpm --filter @ncfritz/olympus-auth-tester auth-tester login
pnpm --filter @ncfritz/olympus-auth-tester auth-tester whoami
```

`docs/guides/signing-in.md` is what has to be true before `login` can work:
the tables, the signing keys, a provider, the four settings, and a user.

## The commands

| Command                      | Does                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `login`                      | signs in through a provider and stores the tokens                |
| `whoami`                     | the caller as the API has them, and the access token's claims    |
| `sessions`                   | every session this user is signed in on; the caller's is starred |
| `revoke <session-id>`        | ends one of them                                                 |
| `logout`                     | ends the session these tokens belong to                          |
| `refresh`                    | rotates the refresh token                                        |
| `refresh --replay`           | presents the previous one again: reuse detection                 |
| `call <method> <path>`       | any API call with the access token                               |
| `agent-call <method> <path>` | a call on the mTLS listener with a service certificate           |

| Option                   | For                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `--api <url>`            | the API, version included (`$OLYMPUS_API_BASE_URL`, else `http://localhost:3001/v1`)          |
| `--external`             | the API at `$OLYMPUS_EXTERNAL_API_BASE_URL`: the border rather than a workspace               |
| `--provider`             | which identity provider to sign in with (default `google`)                                    |
| `--port <n>`             | the loopback port to catch the redirect on (default: any free one)                            |
| `--stale`                | send the stored access token even though it has expired                                       |
| `--tokens <path>`        | where the tokens are kept (`$OLYMPUS_AUTH_TESTER_TOKENS`, else `~/.olympus/auth-tester.json`) |
| `--cert --key --ca --as` | `agent-call`: the certificate, its key, the CA to verify the API, and the caller name         |

## What each command is actually testing

**`login`** — the listener is started before the URL is built, because the
port is part of the `redirect_uri` and the API compares that URI three times:
when the sign-in starts, when the provider comes back, and again at the
exchange. The state is checked here, by this client, which is the half of CSRF
protection the API cannot do for you. A refused sign-in comes back as
`access_denied` and nothing else — no such user, an unverified address and a
disabled one are one answer to a client and three lines in the API's log, on
purpose.

**`whoami`** prints both the directory's answer and the token's claims because
they can disagree, and the disagreement is the design: `roles` in the token is
a ten-minute-old snapshot, while the endpoint reads the directory now.

**`refresh --replay`** is the one flow whose success looks like a failure. A
refresh token that has already been rotated is refused **and the session is
revoked** (ADR 0018), so the command makes both requests: the replay, then the
live token. The second is what tells a refusal apart from a revocation — a
refusal alone would be satisfied by an API that had simply forgotten the old
token. If either succeeds, the command says which expectation broke and exits
non-zero.

**`call`** takes a path relative to the base URL, which already carries the
version — and the API's layout catches people out: a domain's endpoints are
behind its own prefix (`/olympus/ping`, `/dionysus/movie/603`) while
authentication is not (`/auth/me`). A 404 says so when the prefix looks
missing.

**`agent-call`** sends `X-Olympus-Client` as the certificate's common name,
because the API rejects a request where the two disagree. `--as` is how you
exercise that rejection deliberately rather than hitting it by accident.

```sh
auth-tester agent-call GET /olympus/ping \
  --cert infra/dev-ca/agents/dionysus-metadata-agent/client.crt \
  --key  infra/dev-ca/agents/dionysus-metadata-agent/client.key \
  --ca   infra/dev-ca/services-ca.crt
```

## Tokens

`~/.olympus/auth-tester.json`, mode 600 in a mode-700 directory, holding the
access token, the refresh token, and the refresh token the last rotation
replaced — that last one only so `refresh --replay` has something to replay. No
command prints a token. `whoami` prints claims, which are not secret.

The file records which API issued the tokens, and a command refuses rather
than sending dev's tokens to production: the 401 that would follow looks like a
broken API instead of a mistake.

## What it does not do

- **No device certificate.** `--device-cert <p12>` belongs to the border in
  phase 6, and Node's HTTPS client is not what has to present it: the question
  the border raises is whether Safari and an iOS app can, which is what
  `apps/auth-tester-mobile` is for.
- **It does not verify tokens.** Whether the signature is good is the API's
  answer to give; a tester checking it against the same JWKS would only prove
  that two copies of the same code agree. The proof is the API accepting it.
- **One API instance.** Authorization codes and pending sign-ins are held in
  memory, so a sign-in that starts on one instance has to come back to it.
