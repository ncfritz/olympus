# Turning sign-in on

What has to be true before anyone can sign in, and how to prove it works
without a site or an app in front of it.

Five things, and missing any one of them fails in its own way:

1. The `users`, `user_identities` and `sessions` tables, with
   `users.email_normalized`.
2. A directory of ES256 signing keys.
3. A provider — an OAuth client registered with Google, with the API's own
   callback URL.
4. Four settings pointing at those.
5. A user in the directory. Signing in never creates one (ADR 0018).

Do it against a laptop first. `http://localhost` is the one non-HTTPS
redirect URI Google accepts, so a local API needs no proxy, no certificate
and no DNS — and everything that can be wrong is wrong in the same way
there as in production.

## 1. The schema

```sh
cd infra/hasura
hasura migrate status --database-name olympus
hasura migrate apply --database-name olympus
hasura metadata apply
```

**Both.** A migration changes Postgres; the engine's metadata is what
decides which columns exist in GraphQL and what they are called there —
`email_normalized` is exposed as `emailNormalized`. Applying only the
migration leaves the column in the database and absent from the schema the
API queries, which fails as
`field 'emailNormalized' not found in type 'olympus_users_bool_exp'`.

The deployed Hasura image applies migrations _and_ metadata when it starts
(ADR 0019), so this is a two-command step only when the CLI is driving it —
which is `hasura-dev`, by hand. If a column is added without the metadata
files changing, `hasura metadata reload` is what makes the engine
re-inspect the database.

`users.email_normalized` is the column an identity is linked by, and it
arrived after the tables did. Without it every lookup by email fails and
`auth:user` cannot find anyone.

## 2. Signing keys

```sh
scripts/signing-keys.sh ~/olympus-secrets/auth-signing-keys
```

One ES256 key per file. Every key in the directory verifies; the last by
filename signs, which is why the name is a date. Rotation is running that
again and restarting — a token names its key by `kid`, so one signed by
yesterday's key keeps verifying.

The directory is read once at startup. The API logs which key it signs with
and that key's `kid`; `/.well-known/jwks.json` serves the public halves.

## 3. A Google client

In the Google Cloud console, an OAuth 2.0 client of type **Web
application**. Its authorized redirect URIs are the **API's** callback, not
the site's:

| Environment | Authorized redirect URI                                       |
| ----------- | ------------------------------------------------------------- |
| a laptop    | `http://localhost:3001/v1/auth/callback/google`               |
| dev         | `https://olympus.dev.ncfritz.net/api/v1/auth/callback/google` |
| production  | `https://olympus.ncfritz.net/api/v1/auth/callback/google`     |

Register all three now; a client can hold several, and the alternative is
going back to the console at each step. HTTPS is required except for
localhost, and raw IP addresses are refused except for loopback.

While the consent screen is in testing, add yourself as a test user.

The client secret makes the provider list a secret file rather than a
setting — `AUTH_OIDC_PROVIDERS_FILE` names it:

```json
[
  {
    "name": "google",
    "issuer": "https://accounts.google.com",
    "clientId": "….apps.googleusercontent.com",
    "clientSecret": "…"
  }
]
```

`name` is the `:provider` in `/v1/auth/authorize` and
`/v1/auth/callback/:provider`, and it is stored on every identity linked
through it — so renaming a provider orphans its links.

**GitHub cannot be a provider yet.** It publishes a discovery document but
[does not implement OpenID Connect in its OAuth flows and issues no ID
tokens for users](https://docs.github.com/en/apps/github-authentication-discovery-endpoints),
and this API reads the subject and the verified email from an ID token's
claims. Supporting it means a second, non-OIDC path that calls `/user` and
`/user/emails`. Synology SSO does speak OIDC and needs nothing new.

## 4. The settings

In `apps/api/dev.env` (or `local.env`, or the environment's own file):

```sh
AUTH_SIGNING_KEYS=/Users/you/olympus-secrets/auth-signing-keys
AUTH_PUBLIC_BASE_URL=http://localhost:3001
AUTH_OIDC_PROVIDERS_FILE=/Users/you/olympus-secrets/oidc-providers.json
# Where the site is served, for exact redirect-URI matching. Only the site
# needs it, so it can wait until there is one.
# AUTH_CLIENT_ORIGINS=https://olympus.ncfritz.net,https://olympus.internal.ncfritz.net
```

`AUTH_PUBLIC_BASE_URL` is one canonical base, including any path the API is
published under (`/api` behind nginx). It decides the callback URL
registered with the provider and the path the refresh cookie is scoped to,
so it is not "whichever origin the person arrived on".

`AUTH_MODE_USERS` can stay `report`. The endpoints that describe the caller
enforce regardless, because an endpoint whose subject is the caller has no
answer without one.

## 5. A user

```sh
pnpm --filter @ncfritz/olympus-api build
pnpm --filter @ncfritz/olympus-api auth:user add you@example.com "Your Name" admin
```

The address has to be the one Google will report, and Google has to report
it as verified. See [the user directory](users.md).

## Proving it

`tools/auth-tester` is phase 4. Until then the flow is six commands, which
is worth doing once anyway — it is the flow a client implements.

A PKCE pair:

```sh
node -e 'const c=require("crypto");const v=c.randomBytes(32).toString("base64url");
console.log("verifier ",v);
console.log("challenge",c.createHash("sha256").update(v).digest("base64url"))'
```

Something to catch the redirect:

```sh
node -e 'require("http").createServer((q,s)=>{console.log(q.url);s.end("done")}).listen(8123)'
```

Then open this in a browser, with the challenge substituted:

```
http://localhost:3001/v1/auth/authorize
  ?client_id=olympus-auth-tester
  &redirect_uri=http%3A%2F%2F127.0.0.1%3A8123%2Fcallback
  &response_type=code
  &code_challenge=<challenge>
  &code_challenge_method=S256
  &state=anything
  &provider=google
```

Google signs you in, the API's callback links your identity to the user
created above, and the listener prints `/callback?code=…&state=anything`.

**The code lives sixty seconds.** Exchange it promptly:

```sh
curl -s -X POST http://localhost:3001/v1/auth/token \
  -d grant_type=authorization_code \
  -d code='<code>' \
  -d redirect_uri='http://127.0.0.1:8123/callback' \
  -d client_id=olympus-auth-tester \
  -d code_verifier='<verifier>' \
  -d device_name='by hand'
```

That returns `access_token` and `refresh_token`. Then:

```sh
curl -s http://localhost:3001/v1/auth/me       -H 'authorization: Bearer <access_token>'
curl -s http://localhost:3001/v1/auth/sessions -H 'authorization: Bearer <access_token>'
curl -s -X POST http://localhost:3001/v1/auth/token \
  -d grant_type=refresh_token -d client_id=olympus-auth-tester -d refresh_token='<refresh_token>'
curl -s -X POST http://localhost:3001/v1/auth/logout -H 'authorization: Bearer <access_token>'
```

Presenting a refresh token that has already been rotated is worth trying on
purpose: it answers `invalid_grant` **and revokes the session**, which is
reuse detection doing its job (ADR 0018). Two clients refreshing at once
look the same as a theft, so they get the same answer.

Authorization codes and pending sign-ins are held in memory, so **this
works on one API instance only** until they move to a shared store. A
restart drops sign-ins that are mid-flight.

## In production

The same five things, wired differently. The paths are in
`infra/docker/compose/olympus.yml` because they are wiring;
`AUTH_PUBLIC_BASE_URL` and `AUTH_CLIENT_ORIGINS` are in
`infra/docker/env/prod/olympus-api.env` because they are not.

| Piece         | How                                                             |
| ------------- | --------------------------------------------------------------- |
| the migration | ships in the Hasura image, which applies it at start (ADR 0019) |
| signing keys  | `${SECRETS_DIR}/auth-signing-keys`, mounted read-only           |
| the providers | `${SECRETS_DIR}/olympus_oidc_providers`, a Docker secret        |
| the settings  | `prod/olympus-api.env`                                          |

On the host, before deploying:

```sh
scripts/signing-keys.sh "$SECRETS_DIR/auth-signing-keys"
# the providers JSON, as in section 3, with the production redirect URI
install -m 600 /dev/null "$SECRETS_DIR/olympus_oidc_providers"
$EDITOR "$SECRETS_DIR/olympus_oidc_providers"
```

Then the images, dev's Hasura first (ADR 0019), and `stack.sh check` before
`up`:

```sh
infra/docker/stack.sh check
infra/docker/stack.sh up data olympus
```

Both files are optional as far as `stack.sh` is concerned, and an empty one
means the same as an absent setting: signing in is unavailable and
everything else works. The API logs which key it signs with at start, or
warns that the directory holds no `.pem` — it will not refuse to start over
it, because one unconfigured feature should not take every endpoint down.

nginx has to be forwarding the client address for the rate limits to count
callers apart (`X-Forwarded-For`, with `TRUSTED_PROXIES`), so deploy the
nginx configuration too if it has not been.

## What tends to go wrong

| Symptom                                                   | Cause                                                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Google: `redirect_uri_mismatch`                           | The URI registered with Google is not `<AUTH_PUBLIC_BASE_URL>/v1/auth/callback/google` exactly, including any `/api` prefix. |
| `field '…' not found in type 'olympus_users_bool_exp'`    | The migration was applied and the metadata was not. `hasura metadata apply`.                                                 |
| `400 unknown provider`                                    | The `provider` in the query is not a `name` in the providers file.                                                           |
| `400 redirect_uri is not registered`                      | The **client's** URI, not the API's. Loopback must be `127.0.0.1` — `localhost` is deliberately not accepted.                |
| Redirected back with `error=access_denied`                | Deliberately vague. The reason is in the API's log: no such user, an unverified address, or a disabled one.                  |
| `temporarily_unavailable`, "signing in is not configured" | `AUTH_SIGNING_KEYS` is unset or the directory holds no `.pem`.                                                               |
| `invalid_grant` on a code that looks right                | More than sixty seconds since the callback, or the code was already used — one attempt each.                                 |
| `invalid_grant` on a refresh token that was working       | It was rotated. Presenting the previous one revokes the session, by design.                                                  |
| `401` from `/v1/auth/me` right after signing in           | The user was disabled or removed after the token was issued; it is read from the directory, not the token.                   |
| A sign-in that starts fine and fails at the callback      | More than one API instance, or a restart in between: the pending authorization is in memory.                                 |
