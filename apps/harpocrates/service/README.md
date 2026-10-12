# @ncfritz/harpocrates-service

Harpocrates's management API and issuance policy
([ADR 0020](../../../docs/decisions/0020-internal-certificate-authority.md)).
It decides everything about a certificate (the CA, the profile's rules,
the names, the key, the serial) and asks the [signer](../signer/README.md)
to sign the result over its Unix socket. It never holds a private key,
except an escrowed one it hands to an admin once. NestJS and Prisma, by
the rules in [api.md](../../../docs/conventions/api.md).

## What it holds

Its own Postgres, `harpocrates-postgres` (`prisma/schema.prisma`):

- **Issuers**: the root, intermediates and issuing CAs, with their
  certificates, usages, name constraints and maximum validity. Roots and
  intermediates are offline; their keys leave encrypted when created and
  come back only for a ceremony.
- **Profiles**: what a certificate may be (seeded: `service`,
  `api-server`, `device`, `internal-tls`, `legacy-device`,
  `code-signing`, `email`, `document`), in versions (ADR 0034): every
  setting lives on a version, a new certificate takes the latest, and an
  enrollment and each certificate record theirs, so a renewal keeps the
  version it was issued under. The seeds are v1. An admin makes a
  profile, edits it (a change of settings is its next version; the
  description alone is not), copies any version into a new profile,
  deactivates it (nothing new may choose it; what it issued renews) or
  reactivates it, and moves chosen certificates' enrollments to another
  of its versions, which their next renewal uses. A profile has a kind
  (ADR 0035): `x509`, or `ssh`, whose versions hold SSH settings (user
  or host certificates, their CA, validity and renewal in hours,
  `force-command`, `source-address`, the `permit-*` extensions); the
  seeded `ssh-user` (16 hours) and `ssh-host` (90 days) are v1.
- **SSH CAs** (ADR 0035): online Ed25519 keys in the signer, one type
  each (`ssh-user-1-g1`, `ssh-host-1-g1`), created by an admin with no
  ceremony; a rotation is the next generation beside the old, which is
  retired and trusted until its certificates expire. Each gives the line
  that trusts it: for `TrustedUserCAKeys`, or an `@cert-authority` line
  for `known_hosts`.
- **SSH principals**: which Unix user names each Olympus identity (its
  email) may log in as, set by an admin.
- **Keys, enrollments, certificates**: every key once, by its
  SubjectPublicKeyInfo hash; one enrollment (the request) per key; the
  key's certificates as its lineage, first issue and renewals.
- **Revocations, escrow exports** and **the audit log**: hash-chained,
  append-only (a trigger refuses updates and deletes).
- **Revocation lists**: each CA's, numbered, where each came from, and
  whether it is published; and the revocations only an imported list
  told it of (XCA's), carried into every list the CA signs after.
- **Deploy targets and deployments**: where a certificate is installed
  for something that cannot renew it, and each certificate installed
  there, with its attempts and last error.

## Rules it applies

- **Issuer choice**: the request's issuer, else the profile's pin, else
  the pinned CA's successor, else the one active CA of the profile's
  purpose whose usages cover the profile's. A CA stops issuing when its
  **issuing window** closes: its expiry less its longest certificate and
  30 days.
- **The key** (ADR 0033): generated in the signer, of the type the
  request names (RSA 2048 to 8192, DSA 2048 or 3072, P-256, P-384,
  P-521 or Ed25519) or else the profile's; brought in (`key`: encrypted
  PKCS#8 PEM or PKCS#12, with its passphrase) where the profile allows a
  generated key, and forgotten by the signer once certified unless
  escrowed; or the subscriber's CSR, of any of those types (RSA and DSA
  from 2048 bits). A version listing key types (`keyAlgorithms`) takes
  only those; one listing CSR signature hashes (`csrSignatureHashes`)
  takes CSRs signed with only those.
- **The version's rules** (ADR 0034), at issuance and at renewal alike,
  from the version the enrollment holds:
  - _Subject_: `subject.attributes` (`{type, value}`, by name or OID) and
    the older `commonName`, `organizationalUnit`, `organization` fields,
    against each attribute's presence (required, optional, excluded),
    default, lock, pattern and count. With no default, the organization
    is the configured one. CN is required and OU and O optional unless a
    version says otherwise.
  - _Names_ (DNS, IP, email, URI, a Microsoft UPN, a registeredID OID):
    each type allowed or required, at least `minNames` of them, inside
    the permitted subtrees of their type and outside the excluded ones
    (RFC 5280: `example.com` is it and below, `.example.com` below only;
    IP networks as address/prefix). UPNs and OIDs have no subtrees.
  - _Usages_, each forced, default or optional (any other is excluded):
    the forced ones always; then the request's `keyUsages` and
    `extendedKeyUsages` (refused if it names an excluded one), else what
    the CSR or the renewed certificate carried (excluded ones dropped),
    else the defaults.
  - _How it is built_: the hash (SHA-256, 384 or 512; none under an
    Ed25519 CA) and, under an RSA CA, PKCS#1 v1.5 or PSS; the subject
    key identifier by RFC 5280's or RFC 7093's method, or none; the
    authority key identifier alone, with the CA's issuer and serial, or
    none; basic constraints critical, not, or left out; the CA's CRL and
    caIssuers URLs each in or out; the CA's alternative names (set with
    `PUT /issuer/{id}`) in or out; certificate policies with a CPS URI
    and user notice; custom extensions by OID, their value DER. A
    version's custom extensions are none Harpocrates builds itself, and
    a minimal version carries none of these.
- **One key, one request**: a key already seen is reissued only for the
  same profile, subject and names, and refused (`409`) for anything else.
  A CA's key is never a subject's. Weak RSA keys (ROCA, close primes) are
  refused.
- **Renewal** reuses the key while it is younger than the profile's
  `maxKeyAgeDays`, and otherwise needs a new key: a CSR, or a generated
  one (of the old key's type) where the profile allows it. A new key is a new enrollment that
  replaces the old one.
- **Revocation** with `keyCompromise` revokes every certificate for the
  key and blocks it for good. An escrowed key is destroyed with its
  lineage's last valid certificate.

Refusals answer `422` and are audited; the signer's own refusals name
its invariant.

## Revocation lists

ADR 0020, Serials, revocation and publication; the scheduler
(`CRL_SCHEDULE_SECONDS`, every 30 seconds) does the work:

- **Online CAs**: a new list when there is none, a day after the last
  (`CRL_REFRESH_HOURS`), and at once on a revocation; valid for 7 days
  (`CRL_VALIDITY_HOURS`). Listed: the CA's revoked certificates until
  they expire, and its imported revocations.
- **Offline CAs**: signed in a ceremony (`POST /ceremony/{id}/crl`),
  valid for 13 months (`CRL_OFFLINE_VALIDITY_DAYS`), or imported.
- **Imported** (`POST /issuer/{id}/crls`, or `cli import-crl`): a list
  signed elsewhere, refused unless the CA's certificate verifies it, it
  has not lapsed, and its number is above every one the CA has. Numbers
  continue from it. An online CA signs a fresh list straight after.
- **Publication**: each CA's newest list and its certificate, DER, as
  `crl/<slug>.crl` and `ca/<slug>.crt` in `PKI_PUBLISHED_DIR` (written
  beside, then renamed), then fetched back through the CA's distribution
  URL and compared before the list counts as published. A failure is
  recorded on the list and retried after 30 seconds, doubling to every
  15 minutes.
- **Sealed**: every run fails and the next tries again, so what was
  missed is signed as soon as the signer unseals.

One instance runs the scheduler; the CLI never does (its revocations
are picked up by the running service's next run).

## API

`/v1`, with the API's access tokens (ADR 0018) and the roles
`pki-operator` and `pki-admin`. The document is
`openapi/harpocrates.json`; the SDK's `harpocrates` client is generated
from it.

| Operation                                                                                                                        | Who                   |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `GET /issuers`, `GET /issuer/{id}`                                                                                               | either role           |
| `PUT /issuer/{id}` (its issuer alternative names)                                                                                | admin, recent sign-in |
| `POST /issuers/roots`, `POST /issuers/import`                                                                                    | admin, recent sign-in |
| `POST /issuers/preview` (a new CA's settings and defaults, unsigned)                                                             | admin                 |
| `POST /ceremonies`, `POST /ceremony/{id}/intermediates`, `.../issuing`                                                           | admin, recent sign-in |
| `GET /ceremony/{id}`, `DELETE /ceremony/{id}`                                                                                    | admin                 |
| `GET /profiles`, `GET /profile/{id}`                                                                                             | either role           |
| `GET /profile/{id}/versions`                                                                                                     | either role           |
| `POST /profiles/preview` (the certificate a version would produce, signed by a throwaway key)                                    | admin                 |
| `POST /profiles`, `PUT /profile/{id}` (a new version), `POST /profile/{id}/copy`, `.../deactivate`, `.../reactivate`, `.../move` | admin, recent sign-in |
| `GET /ssh/cas`, `GET /ssh/ca/{id}`                                                                                               | either role           |
| `POST /ssh/cas` (a CA, or its next generation), `POST /ssh/ca/{id}/retire`                                                       | admin, recent sign-in |
| `GET /ssh/principals`                                                                                                            | admin                 |
| `PUT /ssh/principals/{identity}` (who an identity may log in as)                                                                 | admin, recent sign-in |
| `POST /certificates`, `GET /certificates`, `GET /certificate/{id}`                                                               | either role           |
| `GET /certificate/{id}/download` (`pem`, `der`, `chain`)                                                                         | either role           |
| `POST /certificate/{id}/renew`, `POST /certificate/{id}/revoke`                                                                  | either role           |
| `POST /certificate/{id}/key-export` (PEM, PKCS#12, legacy PKCS#12)                                                               | admin, recent sign-in |
| `POST /certificates/import` (another CA product's, XCA's)                                                                        | admin                 |
| `GET /signer/status`; `POST /signer/seal`, `POST /signer/unseal`                                                                 | either role; admin    |
| `GET /audit/events`, `GET /audit/verification`                                                                                   | either role           |
| `GET /issuer/{id}/crls`                                                                                                          | either role           |
| `POST /issuer/{id}/crls` (import a list)                                                                                         | admin                 |
| `POST /ceremony/{id}/crl` (an offline CA's list)                                                                                 | admin, recent sign-in |

"Recent" is `AUTH_RECENT_SIGN_IN_SECONDS` since the token's `auth_time`.
`/health` and `/metrics` are open.

### Renewal over mutual TLS

A second listener on `RENEWAL_LISTEN_PORT` (9443, ADR 0020) serves
`POST /v1/renew` and nothing else, and that route is a 404 on 3200. It
asks for a client certificate and accepts any in the handshake; the route
then requires one Harpocrates issued, byte for byte, current, not revoked
and not already renewed (401 otherwise), and renews it: the same subject
and profile, keeping the key without a CSR while the profile allows, a
new key with one. A body naming another certificate, or a CSR for
another common name, is a 403. The audit log records the caller as
`certificate:<serial>` on the `renewal` surface.

The listener's own certificate comes from the TLS CA: the service makes a
key in `RENEWAL_TLS_DIR`, issues itself a certificate for
`RENEWAL_HOSTNAMES` under `RENEWAL_TLS_PROFILE`, and renews it at
two-thirds of its life without a restart. Until there is a TLS issuing CA
and the signer is unsealed it waits, and checks again every five minutes.

### Deploy targets

For what can neither renew over mutual TLS nor speak ACME (ADR 0020,
Renewal and delivery), a deploy target installs a certificate whose key
Harpocrates generated and keeps in escrow. A `host_path` target is a
directory named for the target under `DEPLOY_DIR`, which nginx mounts
read-only:

| File            | What                                                             |
| --------------- | ---------------------------------------------------------------- |
| `privkey.pem`   | The key, PKCS#8, unencrypted, mode 0600: `ssl_certificate_key`   |
| `cert.pem`      | The certificate                                                  |
| `fullchain.pem` | It and the CAs above it, not the root: `ssl_certificate`         |
| `deployed`      | Its id and serial, written last: what nginx's watcher reloads on |

Each file is replaced whole, the key first, and read back before the
`deployed` file is written. The signer only exports a key encrypted, so
the service exports it under a passphrase used once and decrypts it; each
deploy is an escrow export (`escrow_exports`, format `deploy`, reason
`Deployed to <target>`) and the key stays in the signer.

Every `DEPLOY_SCHEDULE_SECONDS` the service renews each target's
certificate once its profile's renewal age is reached (keeping the key
while it is young, a new one past the profile's maximum key age), moves
each target to the newest renewal of its certificate however it was
renewed, and deploys what is pending. A failed deployment keeps its
error and is retried after 30 seconds, doubling to every 15 minutes; it
is audited once (`deployment.failed`), and success as
`deployment.deployed`. Creating a target, or pointing it at a reissue,
deploys at once, and needs `pki-admin` after a recent sign-in, as any
escrow export does; deploying again is open to either role. Deleting a
target leaves its files, still served until nginx's configuration stops
naming them.

Each target has an endpoint, `host:port` (its name on 443 unless given),
where the service checks what is actually served: a TLS handshake with
the host as SNI, trusting anything. The answer is `current` (the
target's certificate), `previous` (one it deployed before: nginx has not
reloaded), `other` (one it never deployed) or `unreachable`, kept in
`endpoint_observations` as one row while it stays the same. An endpoint
is checked 30 seconds after each deployment lands, then every
`ENDPOINT_CHECK_SECONDS` while it is `current` and every 5 minutes while
it is not; `POST /v1/deploy-target/:id/check` checks it now.

### ACME

ACME (RFC 8555, ADR 0020) is served on the renewal listener, under
`/acme`, for the TLS CA; its directory is `ACME_BASE_URL/acme/directory`
(by default the listener's first hostname and port:
`https://pki.internal.ncfritz.net:9443/acme/directory`). Every request
is a JWS, checked for its URL, a nonce from the `acme_nonces` table (good
once, for 15 minutes) and its key; errors are problem documents.

Registering needs External Account Binding. An admin makes a credential
(`POST /v1/acme/credentials`) for one client, with the names it may
request: exact DNS names, or subtrees (a name and everything below it;
no wildcards, which need `dns-01`). The answer shows its HMAC key once;
binding an account erases it, so a credential registers one account,
and revoking the credential revokes that account. Accounts sign with
ES256/384/512, RS256, PS256 or EdDSA; contacts are `mailto:` only.

An order (up to 20 DNS names, no `notBefore`/`notAfter`: the profile sets
the validity) is checked against its account's policy before anything is
created; a refused name is a `rejectedIdentifier` subproblem. Each name
gets an authorization with an `http-01` and a `tls-alpn-01` challenge.
When the client says a challenge is ready, the service connects to the
name, on `ACME_HTTP_PORT` (80) or `ACME_TLS_ALPN_PORT` (443), trusting no
certificate (the key authorization is the proof), and tries three times,
two seconds apart, before the challenge, its authorization and its order
are invalid with the reason. An order is ready when every name is proved,
and lasts 7 days. Orders, and each challenge's outcome, are audited.

A ready order is finalized with a CSR for exactly its names (a common
name, if any, among them), issued under `ACME_PROFILE` (`internal-tls`:
90 days; any key type Harpocrates certifies) by the same path as any certificate: the profile's
rules, the issuing window, the signer's invariants and the TLS CA's name
constraints. A refused CSR is `badCSR` and leaves the order ready for
another. The certificate is served with the CAs above it, not the root,
to its account; it is revoked by that account or by its own key, with a
reason a subscriber may give (0, 1, 3, 4, 5, 9). An account rolls its
key with key-change. Renewal information (RFC 9773, `renewal-info`)
suggests the profile's renewal age to half-way to expiry, and a window
already past once a certificate is revoked. ACME certificates are
`renewal="automatic"` in `certificate_expiry_days`.

`test/e2e/acmeClients.spec.ts` runs the clients ADR 0020 names against
it: certbot (http-01), lego and acme.sh (http-01 and tls-alpn-01; lego
asks renewal-info before renewing), each registering with a credential,
issuing, renewing and revoking, and Caddy obtaining and serving a
certificate by itself. It is opt-in: `ACME_INTEROP_BIN` names a
directory with `certbot`, `lego`, `acme.sh` and `caddy` (a missing one
is skipped; acme.sh's standalone mode needs `socat`), alongside
`HARPOCRATES_E2E_DATABASE_URL`:

```sh
ACME_INTEROP_BIN=~/acme-clients pnpm test:e2e test/e2e/acmeClients.spec.ts
```

The CA console (`apps/harpocrates/console`) signs in through Olympus
(ADR 0029, 0032) as the API client `harpocrates-ca-console`: this
service completes the sign-in and keeps the tokens in httpOnly cookies
(`harpocrates_access_token`, `harpocrates_refresh_token`), which the
guard takes as well as a Bearer header, refreshing an expired one. A
change riding on the cookies must come from the console's origin. Its
routes:

| Route                       | Who                                                    |
| --------------------------- | ------------------------------------------------------ |
| `GET /auth/login/:provider` | open; a redirect to the API's sign-in (not in the doc) |
| `GET /auth/callback`        | open; sets the cookies (not in the doc)                |
| `GET /v1/auth/current-user` | anyone signed in: their email and pki roles            |
| `POST /v1/auth/logout`      | open; ends the Olympus session, clears the cookies     |

Without `OLYMPUS_API_URL` they answer 503 and only Bearer tokens are
taken.

## Metrics and alerts

| Metric                                                              | What                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `harpocrates_certificates_issued_total{issuer,profile}`             | Issued, renewals included                                                                               |
| `harpocrates_revocations_total{issuer,reason}`                      | Revoked                                                                                                 |
| `harpocrates_refusals_total{invariant}`                             | Requests refused by a profile rule or the signer                                                        |
| `harpocrates_crls_signed_total{issuer,source}`                      | Lists signed or imported                                                                                |
| `harpocrates_crl_signing_failures_total{issuer,reason}`             | Scheduled signings that failed: `sealed`, `refused`, `error`                                            |
| `harpocrates_crl_publication_failures_total{issuer}`                | Publication attempts that failed                                                                        |
| `harpocrates_crl_next_update_timestamp_seconds{issuer,tier}`        | When each CA's newest published list lapses (Unix time)                                                 |
| `harpocrates_crl_publication_pending_seconds{issuer,tier}`          | How long its newest list has waited to be published; 0 once out                                         |
| `harpocrates_deployments_total{target}`                             | Certificates deployed to a deploy target                                                                |
| `harpocrates_deployment_failures_total{target}`                     | Deployment attempts that failed                                                                         |
| `harpocrates_deploy_target_serving{target,result}`                  | 1 for what each target's endpoint served at its last check, 0 for the other results                     |
| `harpocrates_deployment_pending_seconds{target}`                    | How long a target's pending deployment has waited; 0 when none                                          |
| `harpocrates_deploy_target_checked_timestamp_seconds{target}`       | When each target's endpoint was last checked (Unix time)                                                |
| `harpocrates_deploy_target_served_expiry_timestamp_seconds{target}` | When the certificate it served then expires (Unix time)                                                 |
| `harpocrates_target_renewal_failures_total{target,reason}`          | Renewals of a target's certificate that failed: `sealed`, `refused`, `error`                            |
| `harpocrates_issuing_window_days{issuer}`                           | Days until each active CA stops issuing                                                                 |
| `harpocrates_profile_renewal_due_days{profile}`                     | Days before expiry a profile's certificates are due for renewal                                         |
| `harpocrates_signer_sealed`                                         | 1 when the signer is sealed or unreachable                                                              |
| `certificate_expiry_days{issuer,profile,subject,serial,renewal}`    | Days left on every valid certificate; `renewal`: `manual`, `automatic` (a deploy target's) or `renewed` |

The gauges are read at scrape time; a scrape never fails because the
database or the signer is down. A list's lapse is a timestamp, not days
left, so its alert still fires from the last value scraped after the
service stops.

The alert rules are `monitoring/harpocrates.rules.yml`, for the
monitoring stack's Prometheus to load from a checkout (`rule_files`),
with the service scraped as job `harpocrates`: the signer sealed for 10
minutes, the service down, a list unpublished for 5 minutes or failing
to sign, an online CA's list within 2 days of lapsing and an offline
CA's within 60, an active CA with no list, an issuing window under a
year, certificates past their profile's renewal point that nothing
renews, and anything within a week of expiry; and for deploy targets, a
deployment waiting an hour, a renewal failing for half an hour, an
endpoint not serving its certificate for 15 minutes, and an endpoint
serving one within a week of expiry. `pnpm check:alerts` (in
`check:conventions`) runs their tests with `promtool`, and says so when
`promtool` is missing (`brew install prometheus`).

## Commands

```sh
pnpm dev                 # watch, reading dev.env
pnpm prisma:deploy       # apply the migrations to DATABASE_URL
pnpm cli <command>       # the break-glass CLI, reading dev.env
pnpm test                # unit, conventions and the API without a database
pnpm test:e2e            # against Postgres and a spawned signer (below)
```

The break-glass CLI runs in the image as
`node dist/cli.js <command>`, against the database and the signer
without the API, as `cli:<user>` with admin rights, and audited like
anything else:

```sh
status
issue --profile <id> --cn <name> [--ou <unit>] [--dns <name>]... [--ip <address>]... [--csr <file>] [--issuer <id>]
revoke --certificate <id> --reason <reason> [--comment <text>]
audit-verify
crls                       # sign what is due and publish what is not out, now
import-issuer --id <slug> --tier <root|intermediate|issuing> --number <n> --generation <g>
              [--purpose <purpose>] --certificate <file> [--chain <file>]...
              [--max-validity-days <days>] [--eku <oid>]...
              [--key <encrypted PKCS#8> [--passphrase-file <file>]] [--closed]
import-crl --issuer <slug> --crl <file>   # PEM or DER
import-certificates --profile <id> --file <PEM bundle or DER>...
export-key --certificate <id> --format <pem|pkcs12|pkcs12-legacy> --reason <text> --out <file>
ceremony --issuer <slug> --key <encrypted PKCS#8> [--plan <JSON>] [--crl] [--remove-key]
```

`import-issuer --closed` imports an issuing CA that signs its lists and
nothing new. A passphrase not given with `--passphrase-file` is asked for
on the terminal, never taken as an argument. `ceremony` opens the offline
CA's key in the signer, creates the issuing CAs its plan lists
(`../ceremonies`), signs its list with `--crl`, and closes whatever
happens. The API's ceremony and export operations need a recent sign-in;
until something can mint one (the console, phase 7), these are how.

In the stack, `infra/docker/stack.sh compose harpocrates exec -it
harpocrates node dist/cli.js <command>`. The cutover from XCA is the
import commands and three ceremonies ([the guide](../../../docs/guides/harpocrates-cutover.md));
`scripts/dev-ca-import.sh` rehearses the imports against the dev CA
(`scripts/dev-ca.sh`).

The e2e tests need `HARPOCRATES_E2E_DATABASE_URL`, a database they may
create and drop schemas in, and `uv` for the signer; without the URL
they are skipped. Each file builds a hierarchy (root, intermediate and
issuing CAs through ceremonies) in a fresh schema, with its own signer on
a temporary store, and checks the results with `openssl`:

```sh
HARPOCRATES_E2E_DATABASE_URL=postgresql://harpocrates:<password>@localhost:5433/harpocrates pnpm test:e2e
```

## Environment

| Variable                      | Default                                                   | Meaning                                                                                            |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | —                                                         | `harpocrates-postgres`; or `DATABASE_URL_FILE`, a file holding it (the stack's secret)             |
| `LISTEN_PORT`                 | `3200`                                                    | The management API, `/health` and `/metrics`                                                       |
| `SIGNER_SOCKET_PATH`          | —                                                         | The signer's socket                                                                                |
| `SIGNER_TOKEN_FILE`           | —                                                         | The shared token (a secret)                                                                        |
| `AUTH_JWKS_URL`               | —                                                         | The API's published keys; or                                                                       |
| `AUTH_JWKS_FILE`              | —                                                         | the same as a file (exactly one of the two)                                                        |
| `AUTH_AUDIENCE`               | `olympus-api`                                             | The tokens' audience                                                                               |
| `AUTH_RECENT_SIGN_IN_SECONDS` | `300`                                                     | How recent a sign-in ceremonies and escrow export need                                             |
| `OLYMPUS_API_URL`             | —                                                         | The API, server to server, for the console's sign-in; unset, there is none                         |
| `OLYMPUS_SIGN_IN_URL`         | `OLYMPUS_API_URL`                                         | Where a browser reaches the API to sign in                                                         |
| `AUTH_BASE_URL`               | `http://localhost:<LISTEN_PORT>`                          | Where a browser reaches this service; the sign-in completes at `/auth/callback` here               |
| `WEB_APP_URL`                 | —                                                         | The console: the cookies' path, CORS, and where a sign-in may return to                            |
| `PKI_REALM`                   | `ncfritz.net`                                             | The prefix of CA names: `<realm> TLS Issuing CA 1 - G1`                                            |
| `PKI_ORGANIZATION`            | `ncfritz.net`                                             | `O=` in the names it issues                                                                        |
| `PKI_DISTRIBUTION_URL`        | `http://pki.internal.ncfritz.net`                         | Where lists and CA certificates are served, and read back from                                     |
| `SSH_HOST_PATTERN`            | `*.internal.ncfritz.net`                                  | The hosts an SSH host CA vouches for: its `@cert-authority` line's pattern (ADR 0035)              |
| `PKI_PUBLISHED_DIR`           | —                                                         | The directory the distribution host serves                                                         |
| `CRL_VALIDITY_HOURS`          | `168`                                                     | An online CA's list's validity                                                                     |
| `CRL_REFRESH_HOURS`           | `24`                                                      | How old an online CA's list gets before it is re-signed                                            |
| `CRL_OFFLINE_VALIDITY_DAYS`   | `395`                                                     | An offline CA's list's validity, signed in a ceremony                                              |
| `CRL_SCHEDULE_SECONDS`        | `30`                                                      | How often the scheduler runs; `0` turns it off                                                     |
| `RENEWAL_LISTEN_PORT`         | `9443`                                                    | The renewal listener; `0` turns it off                                                             |
| `RENEWAL_TLS_DIR`             | `/var/lib/harpocrates/renewal-tls`                        | Its own key and certificate                                                                        |
| `RENEWAL_HOSTNAMES`           | `pki.internal.ncfritz.net`                                | The names its certificate is issued for, comma-separated                                           |
| `RENEWAL_TLS_PROFILE`         | `internal-tls`                                            | The profile it is issued under                                                                     |
| `DEPLOY_DIR`                  | `/srv/harpocrates/deployed`                               | Where `host_path` deploy targets are written, a directory each                                     |
| `DEPLOY_SCHEDULE_SECONDS`     | `60`                                                      | How often targets are renewed, followed and deployed; `0` turns it off                             |
| `ENDPOINT_CHECK_SECONDS`      | `3600`                                                    | How often a target's endpoint is checked while it serves its certificate; `0` turns the checks off |
| `ACME_BASE_URL`               | `https://<first RENEWAL_HOSTNAMES>:<RENEWAL_LISTEN_PORT>` | Where ACME clients reach the renewal listener: the start of every ACME URL                         |
| `ACME_PROFILE`                | `internal-tls`                                            | The profile ACME certificates are issued under                                                     |
| `ACME_HTTP_PORT`              | `80`                                                      | The port `http-01` is validated on                                                                 |
| `ACME_TLS_ALPN_PORT`          | `443`                                                     | The port `tls-alpn-01` is validated on                                                             |
| `ACME_CHALLENGE_RESOLVE`      | —                                                         | An address every challenge connects to, whatever its name resolves to: tests only                  |

Logging is the shared set (`LOKI_URL`, `CONSOLE_LOGGING_LEVEL`, ...) in
`dev.env.example`.
