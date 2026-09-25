# Authentication: phased implementation plan

The implementation of [ADR 0018](../../decisions/0018-authentication.md).
Each phase ends in a working, deployable state and a functional sign-off
against [signoff.md](signoff.md). Nothing is rejected until phase 8: the
guard reports what it would reject, so each caller can be moved and
checked before enforcement.

| Phase | Delivers                                                   | Depends on | Sign-off flows          |
| ----- | ---------------------------------------------------------- | ---------- | ----------------------- |
| 0     | Hasura migrations baseline, dev CA, dev compose            | —          | —                       |
| 1     | Auth core in the API, report-only; service mTLS on `3443`  | 0          | F6, F7 (dev), F11       |
| 2     | Agents on mTLS (Docker and NAS), real certificates         | 1          | F6, F7, F8              |
| 3     | Token service: users, sessions, providers, PKCE, refresh   | 0, 1       | F1, F2, F3, F4 (tester) |
| 4     | Auth testers: CLI and React Native (iOS) proof of concept  | 3          | F5 (internal)           |
| 5     | Site import, changed only for authentication               | 3          | F1, F2, F3, F4, F10     |
| 6     | Border: NAS nginx, device certificates, DNS, redirect URIs | 3, 4, 5    | F9, F5, F1–F3 external  |
| 7     | Key rotation and operations runbooks                       | 3          | F12, F8                 |
| 8     | Enforcement: services first, then users                    | 2, 5, 6    | F13, then all           |
| Later | The internal CA (ADR 0020); the iOS app                    | 8          |                         |

Phases 2 and 3 are independent and can run in either order or together.

## Phase 0 — Prerequisites

1. **ADR 0018 accepted.**
2. **Hasura migrations baseline** (the minimal part of roadmap phase 4):
   **done 2026-09-20** — `infra/hasura` is a CLI v3 project (the
   2026-09-20 schema as the baseline migration, the metadata split into
   files, the connection `from_env`), and
   Postgres and Hasura run from the `data` stack (ADR 0019; the
   workspace-only `dev.yml` it started with is gone), applying both on
   start. API tests keep using the GraphQL double; the auth migration
   gets an integration test against the real Hasura.
3. **Dev CA** (`scripts/dev-ca.sh`): **done 2026-09-20** — a throwaway
   root with Olympus Services and Olympus Devices intermediates (ECDSA
   P-256), the API's `3443` server certificate (`olympus-api`,
   `localhost`, `api.olympus.internal.localhost`, `127.0.0.1`), a
   certificate per agent deployment, device certificates, and the
   revoked, expired and wrong-intermediate certificates the sign-off
   cases need, in a git-ignored `infra/dev-ca/`. Checked against a Node
   TLS server: valid agent certificates are accepted and the revoked,
   expired, wrong-intermediate, device and missing ones are refused
   during the handshake.
4. **Dev compose**: Postgres and Hasura (**done**). The API runs from
   the workspace against them, so its two listeners are configured in
   `apps/api/dev.env`, not in compose; the border nginx arrives in phase 6.

## Phase 1 — Auth core in the API (report-only) — done 2026-09-20

1. `auth/` feature folder: `Principal` (`user` | `service`),
   `@Public()`, `@Roles(...)`, `@CurrentPrincipal()`.
2. A global guard with `AUTH_MODE_SERVICES` and `AUTH_MODE_USERS`, each
   `report` or `enforce` (default `report`): in report mode it resolves the principal, logs and counts
   (`auth_decisions_total{listener,outcome,reason}`) what it would reject,
   and lets the request through.
3. **The `3443` listener**: a second Node HTTPS server over the same
   Express app (`requestCert`, `rejectUnauthorized`, the Services CA, and
   the revocation lists — Node reads only the first list in a file, so
   `TLS_CRL_SERVICES` is a list of paths, the intermediate's and the
   root's; reloaded with `setSecureContext()` when a file changes, no
   restart); the service strategy
   (CN → principal, OU → deployment, roles from
   `AUTH_SERVICE_ROLES`); a mismatching `X-Olympus-Client` is a rejection.
4. The request metrics take `client` from the verified identity
   (certificate CN on `3443`; token `client_id` on `3100` from phase 3).
5. Configuration: `TLS_CERT`, `TLS_KEY`, `TLS_CA_SERVICES`,
   `TLS_CRL_SERVICES`, `SERVICES_LISTEN_PORT` (3443), `AUTH_MODE_SERVICES`,
   `AUTH_MODE_USERS`, `AUTH_SERVICE_ROLES`.
6. Tests: both listeners with the dev CA; valid, expired, revoked and
   wrong-CA certificates; header mismatch; report vs enforce; role checks.

Delivered in `apps/api/src/auth/`: `principal.ts`, `authDecorators.ts`,
`AuthGuard.ts`, `authMetrics.ts`, `services/ServiceIdentityService.ts` and
`servicesListener.ts`, with `AuthModule` binding the guard globally.
`MetricsController` is `@Public()`. The `client` metric label comes from
the peer certificate's common name when there is one
(`packages/nest`'s `httpServerMetrics` takes a `client` resolver).
`test/api/services.spec.ts` drives a real TLS handshake against the dev
CA; the guard, the service strategy and the new configuration have unit
tests.

Not yet done here: nothing rejects. Both listeners default to `report`,
and no agent presents a certificate until phase 2.

## Phase 2 — Agents on mTLS — done 2026-09-24

1. `@ncfritz/olympus-client`: Node-only TLS options (certificate, key, CA)
   on a keep-alive HTTPS agent; the Nest module reads `API_CLIENT_CERT`,
   `API_CLIENT_KEY` and `API_CA_CERT`. Tests against an HTTPS server with
   the dev CA. **done 2026-09-20** — `@ncfritz/olympus-client/tls` and
   `readApiClientConfig` in `@ncfritz/olympus-nest`; all four agents read
   the three variables and present their certificate when they are set
   (**done 2026-09-20**), so what is left in this phase is operational.
2. `API_BASE_URL=https://olympus-api:3443/v1` and the certificate paths for
   all four at once, not a commit each: they share one anchor in
   `olympus.yml`, and with `AUTH_MODE_SERVICES=report` a failure is recorded
   rather than breaking anything, so moving them singly buys nothing. Each
   deployment's files are `client.crt`, `client.key` and `services-ca.crt`
   in its own TLS directory; an environment with no certificates sets the
   three variables empty and stays on plain HTTP, which is how `local`
   runs. **done 2026-09-24** — the certificates are yours to issue.
3. The NAS asset agent: `https://api.olympus.internal.ncfritz.net:3443/v1`;
   `3443` published on the Mac Mini's LAN address; the internal DNS record.
   **done 2026-09-24** — and it found that the chain does not separate
   services from devices
   ([ADR 0023](../../decisions/0023-service-certificates-are-checked-by-issuer.md)).
4. Real certificates from XCA: the Olympus Services intermediate, the
   API's server certificate, one certificate per agent deployment. The
   runbook is [docs/guides/certificates.md](../../guides/certificates.md)
   (**done 2026-09-20**); issuing them is yours to do. The issuing CA, the
   API's server certificate and the NAS's client certificate are **done
   2026-09-24**, and the listener runs on them. Outstanding: four `OU=prod`
   client certificates, one per on-host agent.
5. Done when the report-only log shows every agent request identified
   and none that would be rejected. **done 2026-09-24**, though lightly:
   `auth_decisions_total` has no per-service label, so `allow` rising does
   not prove all five deployments are getting through. The per-client
   counter (ADR 0017's `client` label) is what would, and phase 7 is where
   that becomes something watched rather than something checked by hand.

Found in the Docker audit (2026-09-21): the notification agent relays
to browsers through the API's Socket.IO gateway, which runs on the users
listener, accepts any origin and authenticates nobody, and is not served
on `3443`. Before phase 8 the gateway needs a service path for the agent
(or the relay moves to RabbitMQ) and a token check for browsers.

## Phase 3 — Token service

1. Migration: `users` (id, display name, email, roles, disabled),
   `user_identities` (provider, subject, user, email at link time),
   `sessions` (id, user, client, device name, refresh hash, previous hash,
   created, last used, expires, revoked). Hasura permissions: admin only.
2. **Clients** (configuration, not the database):

   | Client id             | Kind   | Redirect URIs                                                                                     | Refresh token   |
   | --------------------- | ------ | ------------------------------------------------------------------------------------------------- | --------------- |
   | `olympus-site`        | public | `https://olympus.internal.ncfritz.net/auth/callback`, `https://olympus.ncfritz.net/auth/callback` | httpOnly cookie |
   | `olympus-ios`         | public | `olympus://auth`                                                                                  | response body   |
   | `olympus-auth-tester` | public | `http://127.0.0.1:*/callback` (loopback), `olympus-auth-tester://auth`                            | response body   |

3. **Providers**: GitHub (OAuth), Google (OIDC), Synology SSO (OIDC), each
   an API OAuth application with the API's callback URLs. Identities link
   to users by verified email on first sign-in; a user who doesn't exist
   is refused. `pnpm --filter @ncfritz/olympus-api auth:user` adds users
   and sets roles — `add`, `show`, `list`, `roles`, `disable`/`enable` and
   `unlink` (for when a first sign-in links the wrong account). See
   [the user directory](../../guides/users.md). **done 2026-09-25.**
4. **Endpoints** (public, under `/v1/auth`): `authorize`,
   `callback/:provider`, `token` (`authorization_code`, `refresh_token`),
   `logout`, plus `/.well-known/jwks.json`. For signed-in users:
   `DescribeCurrentUser`, `ListSessions`, `RevokeSession`.
5. **Tokens**: ES256 access tokens (10 minutes; `sub`, `client_id`,
   `aud`, `roles`, `auth_time` from the session's creation, `kid`); opaque refresh tokens (30 days), rotated, with
   reuse detection revoking the session. Keys from `AUTH_SIGNING_KEYS`
   (a directory of PEM files, newest signs, all verify).
6. The JWT strategy on `3100`; rate limits on the auth endpoints — per
   caller **and** a global ceiling, because a reverse proxy that does not
   forward the client address makes a per-caller limit either useless or an
   outage. Which is what `3100` was doing: nginx now sends
   `X-Forwarded-For`, and the API believes it only from `TRUSTED_PROXIES`.
   None of this is a credential defence — codes, verifiers and refresh
   tokens are all 256-bit and single-use — it is flood containment.
   **done 2026-09-25.**
7. Tests: every endpoint and error, PKCE, reuse detection, expiry, a
   disabled user, the provider callbacks with a fake provider, and the
   migration against the dev Hasura.

## Phase 4 — Auth testers

Proves the flows before the site or an iOS app depends on them.

**`tools/auth-tester` (Node CLI)**, the scripted half of sign-off and the
pattern for desktop apps (RFC 8252 loopback redirect):

| Command                                | Does                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `login --provider github [--external]` | PKCE with a loopback redirect; opens the browser; stores tokens in a file |
| `whoami`                               | `DescribeCurrentUser`, and the decoded token claims                       |
| `call <method> <path>`                 | any API call with the access token                                        |
| `refresh`, `refresh --replay`          | rotates; `--replay` presents the previous token again (reuse detection)   |
| `logout`, `sessions`, `revoke <id>`    | session management                                                        |
| `agent-call --cert --key <path>`       | a call on `3443` with a service certificate                               |
| `--device-cert <p12>`                  | presents a device certificate (the border, phase 6)                       |

**`apps/auth-tester-mobile` (React Native, Expo)**, the mobile proof of
concept, built the way the iOS app will be:

- An Expo app in the workspace; Turbo runs its typecheck, lint and unit
  tests; the app itself is built with a development build
  (`npx expo run:ios`, Xcode on a Mac), not Expo Go, because it has a
  native module.
- Screens: provider sign-in, token claims, "Call API", "Refresh",
  "Replay previous refresh token", "Sign out", sessions, a log of every
  request and response.
- Sign-in with `expo-web-browser`'s `openAuthSessionAsync`
  (`ASWebAuthenticationSession` on iOS) and the
  `olympus-auth-tester://auth` callback; PKCE with `expo-crypto`; tokens in
  the Keychain with `expo-secure-store`.
- API calls through `@ncfritz/olympus-client` with its auth option (the
  first React Native use of the package).
- A local Expo module, `client-identity` (Swift): imports a device
  certificate (`.p12` from Files, with its password) into the app's
  Keychain, and performs requests on a `URLSession` that answers
  client-certificate challenges with it. React Native's own networking
  can't present a client certificate, so the client package gets an axios
  adapter over this module (`createOlympusClients({ axios: { adapter } })`).
  The same module is what the iOS app will use.

The risks it retires:

1. Whether `ASWebAuthenticationSession` presents a device certificate
   installed by configuration profile at the border.
2. That the app's own requests can't use profile-installed identities,
   so the app must import the `.p12` itself (a second install step for
   users), and that the native module and adapter handle it.
3. The custom-scheme redirect, Keychain storage, refresh when the app
   returns from the background, and `@ncfritz/olympus-client` under React
   Native.

Internally (phase 4) the tester runs against the dev border nginx and the
dev CA; externally (phase 6) against the real border.

## Phase 5 — Site import, authentication only

The site is imported (`docs/guides/repo-import.md`) and changed **only**
where authentication needs it; conventions, styles, the SDK wrappers and
everything else wait for the site's own conventions work.

1. Import with history into `apps/site`; the minimum to build in the
   workspace (package name, TS/ESLint config only where the build fails).
2. Remove NextAuth (`[...nextauth]`, `useSession` in `AuthHeader`,
   `AuthWrapper`, `SettingsPanel`, the sign-in page).
3. Sign-in in the browser as a public client: `/auth/signin` builds the
   PKCE request (verifier in `sessionStorage`) and redirects to
   `/api/v1/auth/authorize`; `/auth/callback` exchanges the code at
   `/api/v1/auth/token`. The API sets the refresh cookie; the access token
   stays in memory. On load the site refreshes to restore the session. No
   Next server routes (the site has no `getServerSideProps`, and `/api/`
   belongs to the API).
4. One SDK request interceptor adds `Authorization: Bearer` and, on a 401,
   refreshes once and retries; the existing `client.setConfig` calls stay.
5. The Socket.IO connection sends the access token in its handshake
   (`auth: { token }`); the API's gateway checks it.
6. The content-auth cookie flow is unchanged.
7. nginx on the Mac Mini: remove any route that sends `/api/auth/` to
   NextAuth, so all of `/api/` goes to the API.

## Phase 6 — Border

1. Olympus Devices intermediate; device certificates for each person's
   devices; the revocation list.
2. The NAS nginx: `olympus.ncfritz.net` and `api.olympus.ncfritz.net`
   with Let's Encrypt, `ssl_verify_client on` against Olympus Devices, the
   revocation list, forwarding over HTTPS to `olympus.internal…`.
3. The Mac Mini nginx (host 1) accepts the forwarded traffic; configs in
   `infra/nginx/`.
4. DNS: Cloudflare records (DNS only) and internal records for both
   public names pointing at the NAS; the router forward.
5. Provider redirect URIs for the public names.
6. iOS profile and `.p12` for the tester; the phase 4 risks confirmed on a
   real device outside the LAN.

## Phase 7 — Operations

1. Signing key rotation: add a key, sign with it, retire the old one
   after the access token lifetime; runbook and test.
2. Runbooks: add a user, revoke a user's sessions, lost device
   (certificates are already in
   [docs/guides/certificates.md](../../guides/certificates.md)).
3. `certificate_expiry_days` per certificate the API loads, so a renewal
   is due long before a handshake starts failing.
4. Dashboards later (the monitoring conversation): `auth_decisions_total`
   and the request metrics by client.

## Phase 8 — Enforcement

1. `AUTH_MODE_SERVICES=enforce` once the report log shows no would-be
   rejections for a week.
2. `AUTH_MODE_USERS=enforce` once the site (and tester) run clean.
3. Stop publishing anything that bypasses the listeners; confirm with the
   negative tests (F13).
4. Rollback: set the mode back to `report`; no code change.

## Later

- The internal CA replaces step-ca here: ACME, renewal and published
  revocation lists ([ADR 0020](../../decisions/0020-internal-certificate-authority.md),
  [plan](../internal-ca/README.md)).
- The iOS app in React Native, on the mobile tester's proven pattern:
  its `client-identity` module and the client package's auth option.
