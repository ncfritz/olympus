# 0018. Authentication for users, devices and services

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The API has no authentication. The site signs users in with NextAuth
(GitHub only) but sends the API nothing; agents call it with no
credentials; only the content-auth cookie gates some Dionysus content.
The platform is about to be reachable from outside the LAN, and an iOS
app will call the API.

The callers differ:

- **Web users**, on the LAN and outside it, through the site.
- **iOS (and desktop) apps**, outside the LAN, calling the API directly.
- **Agents on the Mac Mini**, on the same Docker network as the API,
  some with long-running, high-throughput workflows.
- **The asset agent on the NAS**, which runs a subset of the handlers
  and is not on that Docker network.

The audience is small; installing a certificate on each person's device
is acceptable. Certificates are issued by hand in XCA for now. Nothing
may depend on a cloud service.

## Decision

### Hosts

| Host                               | Runs on                   | TLS                                                          | Serves                                                  |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `olympus.internal.ncfritz.net`     | Mac Mini nginx            | internal CA                                                  | the site; `/api` → API `3100`                           |
| `olympus.ncfritz.net`              | NAS nginx (Docker)        | Let's Encrypt; **device certificate required**               | forwards to `https://olympus.internal.ncfritz.net`      |
| `api.olympus.ncfritz.net`          | NAS nginx (Docker)        | Let's Encrypt; **device certificate required**               | forwards to `https://olympus.internal.ncfritz.net/api/` |
| `api.olympus.internal.ncfritz.net` | the API itself (no nginx) | internal CA; **service certificate required** (Node, `3443`) | the API, for agents outside Docker                      |

- Cloudflare resolves the two public names to the router, **DNS only**
  (not proxied, which would end TLS before the NAS). The router forwards
  the public port to the NAS nginx, which renews the Let's Encrypt
  certificates.
- The internal DNS also resolves the public names to the NAS, so devices
  take the same path, device certificate included, at home and away.

### The API's two listeners

| Listener | Protocol                                                          | Reached by                                                                                                          | Identity                     |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `3100`   | HTTP, Docker network only                                         | the Mac Mini nginx, the site's server                                                                               | a JWT the API issued (users) |
| `3443`   | HTTPS; a client certificate from **Olympus Services** is required | Docker agents (`olympus-api:3443`); the NAS (`api.olympus.internal…:3443`, published on the Mac Mini's LAN address) | the certificate (services)   |

- Identity comes only from what the API verified itself: a signature on
  `3100`, a certificate chain on `3443`. No listener trusts an identity
  header, so nothing can be forged by skipping a proxy.
- `3443` is a second Node HTTPS server over the same application. OpenSSL
  checks the chain and the revocation list during the handshake, from
  memory; a connection without a valid certificate never reaches HTTP.
  Agents keep connections alive, so the handshake is paid once per
  connection, and certificates use ECDSA P-256.
- A route is either public (`@Public()`), for users (`3100`), or for
  services (`3443`); roles are checked with `@Roles()`. The principal is
  `{ kind: "user", userId, roles, client }` or
  `{ kind: "service", name, deployment, roles }`.
- The `client` label of the request metrics (ADR 0017) comes from the
  verified identity: the token's `client_id` on `3100`, the certificate's
  CN on `3443`.

### Certificates (XCA)

- Two intermediates under the internal root, both ECDSA P-256:
  - **Olympus Services** signs agent certificates: CN is the app name
    (`dionysus-asset-agent`), OU the deployment (`mac-mini`, `nas`).
    Only the API's `3443` trusts it.
  - **Olympus Devices** signs personal devices (iPhone, laptops). Only
    the NAS nginx trusts it.

  A device certificate can't act as an agent, an agent certificate
  doesn't pass the border, and each is revoked separately.

  > **Amended by [ADR 0023](0023-service-certificates-are-checked-by-issuer.md).**
  > The two issuing CAs are siblings under one parent, so a trust store
  > that terminates at the root accepts either. The API checks the
  > certificate's issuer; the paragraph above describes the intent, not
  > what the chain enforces on its own. 0023 also corrects the number of
  > revocation lists below.

- Revocation lists for both are exported from XCA on every revocation and
  at least monthly. A verifier checks every authority in the chain, so it
  needs the root's list as well as the intermediate's: the API loads them
  as separate files (Node reads only the first list in a file) and
  reloads them with `setSecureContext()` when they change; nginx takes
  both in one file (`ssl_crl`) and reloads.
- The API's `3443` server certificate names `olympus-api` and
  `api.olympus.internal.ncfritz.net`.
- Later: the internal CA
  ([ADR 0020](0020-internal-certificate-authority.md)) replaces manual
  issuance, with the same intermediates and relying parties: ACME,
  renewal and published revocation lists.
- **Escrowed keys.** A device (or service) that cannot generate its own
  key gets one generated by the CA, which keeps it encrypted so the
  certificate can be exported again, as PKCS#12 for an iOS profile or a
  browser. CSR enrollment stays the preference. An export is for
  `pki-admin` only, with a reason, a recent sign-in (`auth_time`, below)
  and an audit record; an escrowed key is deleted when its certificate
  is revoked. Until the internal CA exists, XCA's database is the escrow:
  it already keeps the keys it generated.

### Users and tokens

The API is the authorization server for its own clients, `olympus-site`
and `olympus-ios`:

- Sign-in with GitHub, Google or Synology SSO (OIDC). The API is the
  OAuth client of each provider; a user is allowed when an identity is
  linked to a user in the `users` table.
- The authorization-code flow with PKCE for every client
  (`/v1/auth/authorize`, `/v1/auth/callback/:provider`,
  `/v1/auth/token`). Codes are single-use and live 60 seconds.
- Access tokens: JWTs signed with ES256, 10 minutes, with `sub` (user),
  `client_id`, `aud` (`olympus-api`), `roles`, `auth_time` and `kid`.
  `auth_time` is when the session's provider sign-in completed; refresh
  carries it unchanged, so an operation can require a recent sign-in
  (exporting an escrowed key) and a client meets it by running the
  sign-in flow again, which starts a new session. The public keys
  are served at `/.well-known/jwks.json`; the private keys come from a
  secret file, never the database, and rotate by `kid`.
- Refresh tokens: opaque, 30 days, stored only as a hash in `sessions`,
  rotated on every use. Presenting a rotated token again revokes the
  whole session (reuse detection). The site keeps it in an httpOnly,
  `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`; the iOS
  app in the Keychain.
- Checking a request's token needs no database: the signature is checked
  against the public keys in memory, and roles are in the token. A role
  change or revocation takes effect at the next refresh, within the
  access token's 10 minutes.

### Data

`users`, `user_identities` (provider, subject → user) and `sessions`
(refresh token hash, client, device, expiry, rotation, revocation) are
Hasura tables, the first migration of the migrations workflow (ADR 0006),
whose baseline comes first. Only login, refresh and logout touch them;
services never do. Service roles come from the API's configuration
(certificate CN → roles).

## Diagrams

### Overview

```mermaid
flowchart LR
  subgraph Outside["Outside the LAN"]
    B2["Browser<br/>(device cert)"]
    IOS["iOS app<br/>(device cert)"]
  end
  CF["Cloudflare DNS<br/>DNS only"]
  subgraph LAN
    R["Router<br/>internal DNS, port forward"]
    B1["Browser on the LAN"]
    subgraph NAS
      EDGE["nginx (Docker)<br/>olympus.ncfritz.net<br/>api.olympus.ncfritz.net<br/>Let's Encrypt + device mTLS"]
      NASAGENT["asset agent<br/>(service cert)"]
    end
    subgraph MacMini["Mac Mini (Docker network)"]
      H1["nginx<br/>olympus.internal.ncfritz.net"]
      SITE["site<br/>(Next.js)"]
      subgraph API["API"]
        L3100["3100 HTTP<br/>JWT"]
        L3443["3443 HTTPS<br/>service mTLS"]
      end
      AGENTS["agents<br/>(service certs)"]
      HASURA["Hasura + Postgres<br/>users, identities, sessions"]
    end
  end
  subgraph IdP["Identity providers"]
    GH["GitHub"]
    GG["Google"]
    SY["Synology SSO"]
  end
  subgraph XCA["XCA (internal root)"]
    SVC["Olympus Services CA"]
    DEV["Olympus Devices CA"]
  end

  B2 -. resolves .-> CF
  B2 -- "443" --> R
  IOS -- "443" --> R
  R -- "forward" --> EDGE
  B1 -- "public names" --> EDGE
  B1 -- "internal name" --> H1
  EDGE -- "HTTPS" --> H1
  H1 -- "/" --> SITE
  H1 -- "/api" --> L3100
  SITE -- "server calls, JWT" --> L3100
  AGENTS -- "mTLS" --> L3443
  NASAGENT -- "mTLS, LAN :3443" --> L3443
  API -- "GraphQL" --> HASURA
  L3100 -- "OAuth" --> IdP
  DEV -. "trusted by" .-> EDGE
  SVC -. "trusted by" .-> L3443
```

### Web sign-in

The same on the LAN and outside it; outside, the NAS nginx first
requires the device certificate (see "A user's API request"). The site's
pages run the flow in the browser as a public client; the site needs no
server routes, and the refresh token never reaches JavaScript.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser (site pages)
  participant A as API :3100 (via nginx /api)
  participant P as Provider (GitHub, Google, Synology)
  participant H as Hasura

  U->>B: Sign in with GitHub
  B->>B: /auth/signin: state, PKCE verifier + challenge<br/>(kept in sessionStorage)
  B->>A: GET /api/v1/auth/authorize?client_id=olympus-site<br/>&provider=github&redirect_uri=.../auth/callback<br/>&state&code_challenge
  A->>A: check client_id and redirect_uri,<br/>remember the request under an internal state
  A-->>B: 302 to GitHub's authorize URL (API's OAuth app)
  B->>P: sign in, consent
  P-->>B: 302 /api/v1/auth/callback/github?code&state
  B->>A: GET /v1/auth/callback/github
  A->>P: exchange code (API's client secret)
  P-->>A: provider token, profile (subject, email)
  A->>H: find identity (github, subject) → user
  alt no linked user, or disabled
    A-->>B: 403 "not allowed"
  end
  A->>A: authorization code (single use, 60 s,<br/>bound to the challenge and redirect_uri)
  A-->>B: 302 https://olympus…/auth/callback?code&state
  B->>B: /auth/callback: check state
  B->>A: POST /api/v1/auth/token<br/>grant_type=authorization_code, code, code_verifier
  A->>A: verify the code and PKCE
  A->>H: insert session (refresh token hash, client, device)
  A-->>B: access token (JWT, 10 min) in the body,<br/>Set-Cookie refresh (httpOnly, Secure, SameSite=Strict,<br/>Path=/api/v1/auth)
  B->>B: access token in memory only
```

### Token refresh

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (browser or iOS app)
  participant A as API :3100
  participant H as Hasura

  C->>A: request with an expired access token
  A-->>C: 401
  C->>A: POST /v1/auth/token grant_type=refresh_token<br/>(web: the cookie, iOS: the token from the Keychain)
  A->>H: find session by hash(refresh token)
  alt unknown, expired or revoked
    A-->>C: 401, sign in again
  else token already rotated (reuse)
    A->>H: revoke the session
    A-->>C: 401, sign in again
  else current
    A->>A: roles for the user (current)
    A->>H: rotate: store the new hash, keep the old as "used"
    A-->>C: new access token, new refresh token<br/>(web: Set-Cookie, iOS: body → Keychain)
    C->>A: retry the request
  end
```

### A user's API request

```mermaid
sequenceDiagram
  autonumber
  participant C as Browser or iOS app
  participant E as NAS nginx<br/>(outside only)
  participant N as Mac Mini nginx
  participant A as API :3100
  participant H as Hasura

  C->>E: TLS to olympus.ncfritz.net / api.olympus.ncfritz.net<br/>(Let's Encrypt server cert)
  E->>C: CertificateRequest (Olympus Devices CA)
  C->>E: device certificate
  alt missing, invalid or revoked
    E-->>C: handshake fails / 400
  end
  C->>E: GET /api/v1/dionysus/metadata/movie/603<br/>Authorization: Bearer (JWT)<br/>X-Olympus-Client: olympus-site
  E->>N: HTTPS (internal CA), X-Forwarded-For
  N->>A: HTTP to olympus-api:3100 (prefix stripped)
  A->>A: metrics middleware starts the timer
  A->>A: JWT strategy: kid → public key (memory),<br/>signature, exp, aud = olympus-api
  alt invalid or expired
    A-->>C: 401 (client refreshes)
  end
  A->>A: principal {user, roles, client_id},<br/>@Roles() guard
  A->>H: the operation's GraphQL
  H-->>A: data
  A-->>C: 200 (metrics: client = token's client_id)
```

### iOS sign-in

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant App as iOS app
  participant W as ASWebAuthenticationSession
  participant E as NAS nginx
  participant A as API :3100 (via Mac Mini nginx)
  participant P as Provider
  participant H as Hasura

  U->>App: Sign in
  App->>App: state, PKCE verifier + challenge
  App->>W: open https://api.olympus.ncfritz.net/v1/auth/authorize<br/>?client_id=olympus-ios&redirect_uri=olympus://auth<br/>&provider&state&code_challenge
  W->>E: TLS + device certificate (from the installed profile)
  E->>A: forward
  A-->>W: 302 to the provider
  W->>P: sign in, consent
  P-->>W: 302 https://api.olympus.ncfritz.net/v1/auth/callback/:provider
  W->>E: TLS + device certificate
  E->>A: forward
  A->>P: exchange code, profile
  A->>H: find identity → user
  A-->>W: 302 olympus://auth?code&state
  W-->>App: callback URL
  App->>App: check state
  App->>E: POST /v1/auth/token (URLSession presents the device certificate)<br/>code, code_verifier, client_id=olympus-ios
  E->>A: forward
  A->>H: insert session
  A-->>App: access token, refresh token
  App->>App: refresh token → Keychain,<br/>access token in memory
```

### An agent's API request (Docker)

```mermaid
sequenceDiagram
  autonumber
  participant G as Agent<br/>(@ncfritz/olympus-client, keep-alive)
  participant A as API :3443 (Node TLS / OpenSSL)
  participant App as API application
  participant H as Hasura

  Note over G,A: once per connection
  G->>A: TLS ClientHello to olympus-api:3443
  A->>G: server certificate (olympus-api), CertificateRequest
  G->>G: verify the server certificate against the internal CA
  G->>A: client certificate CN=dionysus-search-agent, OU=mac-mini
  A->>A: chain to Olympus Services, validity, revocation list (memory)
  alt invalid, expired or revoked
    A-->>G: handshake aborted (no HTTP)
  end
  Note over G,App: every request on the connection
  G->>App: POST /v1/dionysus/media/.../search-execution<br/>X-Olympus-Client: dionysus-search-agent
  App->>App: metrics middleware (client = certificate CN)
  App->>App: certificate strategy: principal {service,<br/>dionysus-search-agent, mac-mini, roles from config}
  alt X-Olympus-Client differs from the CN, or role missing
    App-->>G: 401 / 403
  end
  App->>H: the operation's GraphQL (no auth tables)
  App-->>G: 201
```

### The NAS agent's API request

```mermaid
sequenceDiagram
  autonumber
  participant G as Asset agent on the NAS
  participant D as Internal DNS
  participant M as Mac Mini (published :3443)
  participant A as API :3443

  G->>D: api.olympus.internal.ncfritz.net
  D-->>G: the Mac Mini's LAN address
  G->>M: TLS to :3443 (SNI api.olympus.internal.ncfritz.net)
  M->>A: Docker port mapping (TCP, untouched)
  Note over G,A: the same handshake and request as a Docker agent:<br/>server cert names api.olympus.internal.ncfritz.net,<br/>client cert CN=dionysus-asset-agent, OU=nas
```

### Issuing and revoking certificates

```mermaid
sequenceDiagram
  autonumber
  actor O as Operator
  participant X as XCA
  participant G as Agent host (Mac Mini secrets / NAS folder)
  participant Dv as Device (iPhone, laptop)
  participant A as API :3443
  participant E as NAS nginx

  O->>X: new ECDSA P-256 key + certificate,<br/>signed by Olympus Services<br/>(CN = app name, OU = deployment)
  X-->>O: cert.pem, key.pem
  O->>G: install cert, key, internal CA, restart the agent
  O->>X: new device certificate, signed by Olympus Devices
  X-->>O: device.p12
  O->>Dv: install (configuration profile on iOS, keychain on macOS)
  O->>X: revoke a certificate
  O->>X: export both revocation lists (also monthly)
  O->>A: services.crl → the API reloads it
  O->>E: devices.crl → nginx reload
```

## Consequences

- Services never touch the auth tables or Hasura to authenticate; users
  touch them only at sign-in, refresh and sign-out. Checking a request
  costs a signature check or nothing beyond the TLS handshake.
- The API handles TLS for agents. OpenSSL does the work; keep-alive and
  ECDSA keep handshakes rare and cheap.
- Everything outside the LAN needs a device certificate first. Adding a
  person or device means issuing and installing one; losing a device
  means revoking its certificate and its sessions.
- A role change or revocation reaches users within ten minutes, not
  immediately.
- The site drops NextAuth. Each provider needs redirect URIs for the API
  on `olympus.internal…`, `olympus.ncfritz.net` and
  `api.olympus.ncfritz.net`; Synology SSO works where DSM is reachable.
- The iOS sign-in depends on `ASWebAuthenticationSession` presenting the
  profile-installed device certificate; prove it with a test build before
  the app depends on it.
- The minimal Hasura migrations baseline (phase 4) now comes before this
  work.

## Implementation

The phases, the testers and the functional sign-off are in
[docs/plans/authentication](../plans/authentication/README.md). In short:

1. **Foundations.** This ADR accepted; the minimal Hasura migrations
   baseline; the `users`, `user_identities` and `sessions` migration.
2. **Auth in the API.** Principals, `@Public()`, `@Roles()` and a global
   guard in report-only mode (logs what it would reject); the `3443`
   listener (HTTPS over the same app, revocation list reload, CN →
   roles); the `client` metrics label from the verified identity.
3. **Tokens.** Provider sign-in (GitHub, Google, Synology OIDC); the
   authorization-code flow with PKCE; refresh with rotation and reuse
   detection; sign-out and the session list; the key set and JWKS; rate
   limits on the auth endpoints; the JWT strategy on `3100`.
4. **Clients.** `@ncfritz/olympus-client`: Node TLS options (certificate,
   key, CA, keep-alive) for agents, and an auth option (access token,
   refresh and retry once on 401) for the site and apps. The site swaps
   NextAuth for the API's flow; the Socket.IO handshake checks the JWT.
5. **Agents.** One commit per agent onto `3443`, the NAS asset agent onto
   `api.olympus.internal.ncfritz.net:3443`; the XCA runbook.
6. **Border.** The NAS nginx configuration (Let's Encrypt, device
   certificates, forwarding), the Mac Mini nginx, published ports and DNS,
   in `infra/`. Then the guard stops reporting and enforces.
7. **Later.** The internal CA (ADR 0020) for ACME, renewal and escrow; the iOS app on the client package.

Development mirrors production: a script creates a throwaway root with
both intermediates, the API's `3443` certificate and agent and device
certificates; the dev compose runs the API with both listeners and an
nginx standing in for the NAS.
