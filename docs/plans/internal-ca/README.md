# Internal CA: phased implementation plan

The implementation of [ADR 0020](../../decisions/0020-internal-certificate-authority.md),
as [ADR 0032](../../decisions/0032-harpocrates-roots-and-migration.md)
(Proposed) would amend it. Each phase ends in a working, deployable state
and a functional sign-off against [signoff.md](signoff.md). XCA stays in
place: production Harpocrates starts empty and creates its own roots
(phase 5), and what XCA issued is replaced in phase 8, after which XCA is
retired. The [capabilities review](capabilities.md) is the reasoning
behind the 2026-09-25 amendments.

**Reordered 2026-10-09 (ADR 0032).** The console moves ahead of renewal
and ACME, so each phase is exercised through it; the cutover from XCA
becomes a migration after ACME. Phases 5 to 8 were renumbered: the
console was 7, renewal 5, ACME 6, SSH 8.

| Phase | Delivers                                                                                       | Depends on                              | Sign-off flows                                |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| 0     | Scaffolding: both services, Python toolchain, dev CA, dev compose                              | —                                       | —                                             |
| 1     | The signer: key store, automatic unseal, signing, invariants, ceremonies                       | 0                                       | C1 (DEV), C2, C13.1–C13.4                     |
| 2     | Management core: CAs, profiles, keys and enrollments, issuance, escrow, audit                  | 1; authentication phase 3 (`auth_time`) | C3, C4.1–C4.6, C7, C14                        |
| 3     | Revocation lists and monitoring: scheduling, publication, relying parties, alerts              | 2                                       | C5, C6.1 (DEV), C16.1–C16.2                   |
| 4     | The production stack, empty: deployed and initialised                                          | 3; Docker plan phase 3                  | C1.2                                          |
| 5     | The console, and roots: bootstrap, three shapes, overridable settings; the three roots created | 4; console plan                         | C11.1–C11.4, C11.6, C13.5–C13.10, C16.4, C4.8 |
| 6     | Renewal over mutual TLS, deploy targets, endpoint checks                                       | 5                                       | C9, C16.3                                     |
| 7     | ACME, with ARI                                                                                 | 5                                       | C10, C11.5                                    |
| 8     | The migration from XCA, and XCA retired                                                        | 6, 7                                    | C8, C5.4, C6, C4.7, C12                       |
| 9     | SSH certificates                                                                               | 6                                       | C15                                           |
| Later | SCEP, `dns-01`, hardware keys, discovery, a timestamping authority                             |                                         |                                               |

Phases 6 and 7 are independent. The console (phase 5) grows with each
phase after it: renewal and deploy targets, ACME and the migration each
add their screens. Until it exists the API is driven from its OpenAPI
page and the break-glass CLI.

## Phase 0 — Scaffolding

1. **ADR 0020 accepted** (2026-09-25).
2. **Done 2026-09-25.** **`apps/harpocrates/signer`**: a FastAPI app with `pyproject.toml` managed by
   `uv`; `ruff` (lint and format), `pyright` (strict), `pytest`. A
   `package.json` whose `build`, `lint`, `test` and `openapi` scripts
   call them, so `pnpm turbo run build lint test` covers it like any
   other package. The Docker image builds in the central build (ADR
   0011).
3. **Done 2026-09-25.** **`docs/conventions/python.md`**: the rules for the signer, in the
   shape of the other convention documents, and `CLAUDE.md` pointing at
   it for `apps/harpocrates/signer`.
4. **Done 2026-09-25.** **`apps/harpocrates/service`**: a NestJS app on the shared packages
   (`@ncfritz/olympus-nest`: config, logger, metrics), Prisma for its
   database, an `openapi` task writing `apps/harpocrates/service/openapi/harpocrates.json`, and
   `packages/sdk` generating a `harpocrates` client from it. A generated client
   for the signer's document, internal to `apps/harpocrates/service`.
5. **Done 2026-09-25.** **Dev CA**: `scripts/dev-ca.sh` builds the
   hierarchy three deep with an issuing CA per purpose, including a TLS
   issuer name-constrained to `localhost`, `internal.localhost` and
   `127.0.0.0/8` (with `tls/out-of-bounds.crt` for a name it forbids), and
   writes every authority's key as encrypted PKCS#8 — the format the
   signer imports — under `certs/keys/`. The passphrase is `olympus`.
   (Built on both branches; main's version, which keeps what exists and
   adds `--san`, is the one kept at the merge.)
6. **Done 2026-09-25.** **Dev compose**: `apps/harpocrates/docker-compose.yml` runs
   `harpocrates-postgres` on its own port, beside the existing Postgres
   and Hasura; both services run from the workspace (`pnpm dev`), the
   signer on a socket in `apps/harpocrates/.run/` (git-ignored).

**Sign-off:** both services start, `/health` answers, the Turbo tasks
pass, and the SDK builds with an empty `harpocrates` client; no functional flows.

**A constraint on every TLS server certificate this issues:** 825 days of
validity, at most. Apple refuses a longer one and does so against a private
anchor as well, reporting it as the client cancelling rather than as anything to
do with the certificate — so an iPhone on the house network is what would find
it, one afternoon, with nothing in any log to say why. `docs/guides/certificates.md`
has the rest of that page's requirements; the templates already satisfy them.

## Phase 1 — The signer

**Done 2026-09-25** (steps 1 to 10; the sign-off runs on DEV are
outstanding). What differs from the steps below: the key store's check
value is AES-GCM's own tag; the ceremony, escrow and signing operations
are resources (`/v1/issuers/{id}/certificates`,
`/v1/ceremonies/{id}/cas`, `/v1/keys/{id}/export`, ...), described in
[the signer's README](../../../apps/harpocrates/signer/README.md); the
CLI's commands call the running signer over its socket; and registering
an issuer also checks that its chain signs it.

1. **Key store**: SQLite on the signer's volume. Per-key data keys
   (AES-256-GCM), wrapped by a key-encryption key from Argon2id over the
   passphrase; a check value to reject a wrong passphrase.
2. **Seal**: a master key wrapped by the unseal key (a file secret) and
   by the recovery passphrase; the signer unseals itself at start with
   the unseal key, and starts sealed if the secret is missing. `seal` is
   recorded in the store and survives restarts until `unseal` with the
   passphrase. Every signing operation `503` while sealed. `initialise`
   writes a new unseal key and sets the passphrase on an empty store, and
   refuses on a populated one; `rotate-unseal-key` and
   `change-passphrase` rewrap the master key.
3. **Keys**: generate P-256 and RSA 2048 (subject keys only); import
   encrypted PKCS#8 (the XCA issuing CAs); public keys out, never
   private ones.
4. **Signing**: `sign/certificate` from a fully formed request (subject,
   SANs, extensions, validity, serial, and a public key, a CSR, or a key
   id); `sign/crl` from an issuer, number, this and next update and the
   revoked entries.
5. **Ceremonies**: `ceremony/open` imports an offline CA's (a root's or
   an intermediate's) encrypted PKCS#8 with its passphrase and holds it
   for that ceremony only; `ceremony/close` destroys it, as does a
   restart or an hour passing. Creating an offline CA is a ceremony that
   generates the key, signs it (self-signs, for a root), and returns the
   key encrypted under a passphrase given for it, keeping nothing.
6. **Invariants**: the issuer's name constraints over every name, a
   maximum validity and the issuer's own expiry, the issuer's allowed
   extended key usages; `CA:TRUE` only from an offline CA in a ceremony,
   with a path length below its own.
7. **Escrow**: generated keys kept wrapped; `escrow/export` as PEM or
   PKCS#12, modern (AES-256, PBKDF2) or legacy (SHA-1, 3DES; no chain)
   for `legacy-device`.
8. **Transport**: Uvicorn on a Unix socket; the shared token; no TCP
   listener in any configuration.
9. **CLI** (`python -m harpocrates_signer`): `initialise`, `unseal`,
   `seal`, `status`, `rotate-unseal-key`, `change-passphrase`.
10. **Tests**: every certificate and CRL produced is parsed back and
    verified against its issuer with `cryptography` and with `openssl
verify` / `openssl crl -verify`; each invariant has a refusal test;
    automatic unseal, a missing or wrong unseal key, a deliberate seal
    surviving a restart, a wrong passphrase; a root key gone after
    close, restart and timeout.

**Sign-off:** C1 (DEV), C2, C13.1–C13.4.

## Phase 2 — Management core

**Done 2026-09-25** (steps 1 to 10, with the exceptions below; the
sign-off runs on DEV are outstanding). Described in
[the service's README](../../../apps/harpocrates/service/README.md).
What differs from the steps below:

- **External CAs** (CSR out, certificate in, `pending` between) are not
  built: the signer has no endpoint that makes a CSR for a key it holds.
  The `pending` status and the `external` and `csr` columns are in the
  schema for it. Importing an existing CA is built.
- **Weak keys**: ROCA and close primes (Fermat) are checked; the Debian
  blocklist is not.
- **Serials** are drawn when the certificate is signed, and the unique
  `(issuer, serial)` catches the 2^-159 collision, rather than reserved
  first in the certificate's transaction.
- **PKCS#12** is only through `key-export` (admin, recent sign-in), not
  a download: it carries the private key.
- **Generated keys** are destroyed at once when the request they were
  made for fails; a sweep for keys orphaned by a crash between the two is
  not built.
- `harpocrates_refusals_total{invariant}` counts refusals, beside the
  metrics listed; the CLI adds `audit-verify` to `issue`, `revoke` and
  `status`.
- The e2e tests (`pnpm test:e2e`) run the service against Postgres and a
  signer spawned with `uv`, and are skipped without
  `HARPOCRATES_E2E_DATABASE_URL`: nothing in CI runs them yet.

1. **Schema** (Prisma migrations): `issuers`, `ceremonies`, `profiles`,
   `keys`, `enrollments`, `certificates`, `revocations`, `crls`,
   `escrow_exports`, `audit_events`. Foreign keys and constraints
   throughout; a unique serial per issuer; a unique SubjectPublicKeyInfo
   hash across `keys`; one enrollment per key.
2. **CAs**: create a root or an intermediate (ceremonies), an issuing
   CA (signed by an intermediate in a ceremony), or an external one (CSR
   out, certificate in; `pending` between); import an existing CA. Each records its name
   constraints, allowed usages, maximum validity, the distribution URLs
   it writes, and its slug; names follow the ADR's convention. The
   **issuing window** closes a CA to new requests when the longest
   certificate it issues, plus 30 days, no longer fits.
3. **Profiles**: the ADR's set, seeded (the signing profiles included);
   the rules applied before anything reaches the signer; the issuer
   override limited to CAs that could sign.
4. **Keys and enrollments**: one enrollment per key; a CSR whose key
   belongs to another enrollment refused; weak-key checks (Debian, ROCA,
   close primes); `maxKeyAge` per profile; a key revoked for
   `keyCompromise` blocked and its lineage revoked.
5. **Issuance**: 159-bit random serials in the certificate's
   transaction; CSR enrollment (signature and profile checks) and
   generated enrollment (escrowed key); certificate download as PEM,
   chain, DER, and PKCS#12 where the key is escrowed.
6. **Revocation**: revoke with a reason; status on the certificate; an
   escrowed key deleted with its lineage's last certificate.
7. **Auth**: JWTs verified against the API's JWKS (`kid`, `aud`), roles
   `pki-admin` and `pki-operator`; escrow export and ceremonies require
   a recent sign-in, read from the access token's `auth_time` (ADR 0018,
   authentication phase 3).
8. **Audit**: hash-chained, and `harpocrates audit verify`; every
   request and refusal, issuance, revocation, key event, ceremony,
   export, unseal and seal, with the principal, the surface and a
   reason where one is required.
9. **Metrics**: `harpocrates_signer_sealed`,
   `harpocrates_certificates_issued_total{issuer,profile}`,
   `harpocrates_revocations_total{issuer,reason}`,
   `harpocrates_issuing_window_days{issuer}`, `certificate_expiry_days`
   per certificate the CA knows of.
10. **Break-glass CLI** in the `harpocrates` image: `issue`, `revoke`,
    `status`, running against the database and the signer without the
    API.

**Sign-off:** C3, C4.1–C4.6, C7, C14.

## Phase 3 — Revocation lists and monitoring

**Done 2026-09-25** (steps 1 to 6; the sign-off runs on DEV are
outstanding, and C6.2–C6.3 on the NAS are phase 8's). Described in
[the service's README](../../../apps/harpocrates/service/README.md),
Revocation lists and Metrics and alerts. What differs from the steps
below:

- **The API** needed a change after all: Node's TLS takes PEM lists only,
  and a watch on a file misses its replacement by rename (how lists are
  published). It now reads DER or PEM and polls the files every 5
  seconds (`apps/api/src/auth/servicesListener.ts`). Its production
  `TLS_CRL_SERVICES` moves to the published lists at the cutover (phase
  4); `apps/api/dev.env.example` shows the development ones.
- **Imported lists** (`POST /issuer/{id}/crls`, `cli import-crl`): how
  an offline CA's list signed elsewhere, and XCA's last lists, reach
  publication. Numbers continue from them, and their serials are kept
  (`imported_revocations`) and carried into every list the CA signs
  after, so XCA's revocations survive the cutover.
- **Development**: `scripts/dev-ca-import.sh` adopts the dev CA (its
  offline CAs, its issuing CAs with their keys, and its lists), and the
  dev compose serves the published directory on `8480`, so C5 and C6.1
  run against the dev CA the API already trusts.
- **Offline CAs' lists** list only their imported revocations: nothing
  revokes a CA yet (a follow-up below).
- **Alerts** are `apps/harpocrates/service/monitoring/harpocrates.rules.yml`,
  tested with `promtool` in `check:conventions`; the monitoring stack
  loads them from a checkout. "Certificates under their profile's
  threshold" uses `harpocrates_profile_renewal_due_days` (validity less
  renewal age) and `certificate_expiry_days{renewal="manual"}`, which
  is every certificate until phases 5 and 6.
- **The NAS**: `infra/nas/crl-pull.sh`, verifying each list against its
  own CA's pinned certificate, every 15 minutes from DSM's Task
  Scheduler (`infra/nas/README.md`).

1. **Scheduling**: a list per issuer, numbered monotonically, valid 7
   days, signed daily and on every revocation; retries while sealed.
2. **Publication**: DER list and issuer certificate written to the
   published directory (a volume in compose), fetched back through the
   distribution URL and verified, then recorded as published.
3. **The offline CAs' lists**: signed in ceremonies, 13 months, published with
   the rest.
4. **The API**: `TLS_CRL_SERVICES` pointed at the published lists of the
   Service CA's chain: the Service CA, Intermediate CA 2, the root (dev
   first). No code change: it already reloads on change.
5. **The NAS**: a pull script in `infra/` (fetch, verify the Device CA chain's lists,
   concatenate, swap the file, `nginx -s reload`) and its schedule.
6. **Alerts** (Alertmanager rules in the monitoring stack): sealed
   longer than 10 minutes; a publication failed; a published list within
   2 days of its next update; an offline CA's list within 60 days; an issuing
   window under a year; certificates under their profile's threshold
   that do not renew themselves.

**Sign-off:** C5, C6.1 (DEV), C16.1–C16.2.

## Phase 4 — The production stack, empty

**Built 2026-09-25 as the cutover from XCA; that cutover is withdrawn
(ADR 0032).** What stays is the stack and everything around it; what goes
is adopting XCA.

Stays, and is deployed:

- **The `harpocrates` stack** (`infra/docker/compose/harpocrates.yml`) on
  ADR 0019's conventions: its own Postgres on an internal network, the
  signer with no network (`network_mode: none`, the socket shared through
  a volume, group read-write for gid 10001, which the service joins), the
  migrations, the service. File secrets throughout, including
  `DATABASE_URL_FILE`.
- **Directories, not named volumes**: the published directory is
  `${DATA_DIR}/olympus/apps/harpocrates/published`, bind-mounted into the
  stack, nginx (`nginx/pki.conf`) and the API.
- **nginx**: `pki.internal.ncfritz.net` serving the published directory
  over plain HTTP, and `/harpocrates/ca/api` on the control host. The
  internal DNS record.
- `bootstrap` makes the stack's secrets (random), except the unseal key,
  which starts empty (an empty file is no key: the signer starts sealed)
  until `initialise`.
- The CLI's import commands (`import-issuer`, `import-certificates`,
  `import-crl`), used by `scripts/dev-ca-import.sh` and kept for CAs
  Harpocrates does not create.

Withdrawn, and removed in phase 5 once the console's bootstrap replaces
it: [the cutover guide](../../guides/harpocrates-cutover.md) (its steps 1
and 2, the stack and `initialise`, remain the way to do this until then),
the ceremony plans in `apps/harpocrates/ceremonies`, and the commented
`TLS_CRL_SERVICES` line in `env/prod/olympus-api.env`, which phase 8
replaces with one naming both chains.

1. Build and push the images; `stack.sh bootstrap`, `check` and
   `up harpocrates` on the Mac Mini.
2. `initialise` the signer; the unseal key into `${SECRETS_DIR}` as
   `harpocrates_signer_unseal_key` and, with the recovery passphrase, into
   the password manager. Restart and confirm it unseals by itself.

Nothing is created: no root, no CA, no certificate. That is phase 5,
through the console.

**Sign-off:** C1.2.

## Phase 5 — The console, and roots

`apps/harpocrates/console` (`@ncfritz/harpocrates-console`), on
`packages/console` (ADR 0021, the shell with the rail, the page list and
the trail) and the SDK's `harpocrates` client, with what ADR 0032 adds to
the signer and the service. The mockups are the design canvas
(`claude/harpocrates-console-layout.md` in the project).

1. **Wiring**: the Harpocrates property and its `ca` console in the
   registry, `/harpocrates/ca` and `/harpocrates/ca/api` in nginx on the
   control host, the `harpocrates-ca-console` bake target, the host's
   `CONTROL_CONSOLES`.
2. **Bootstrap**: initialise from the console (the service calls the
   signer's `initialise`; the unseal key shown once); the restart check;
   the seal state on every page and unseal for `pki-admin`.
3. **Roots** (signer and service):
   - a root's **shape** (three tiers, two tiers, direct) and its path
     length from it; ceremonies offer only what the shape allows;
   - **per-root naming**: organisation and an optional purpose, and a
     subject written outright, unique across Harpocrates;
   - **prove the backup**: the new root's key given back from the
     offline media opens its first ceremony; **discard** a root that
     has signed nothing;
   - a root's **first list** signed in its first ceremony, and its
     certificate and list published before anything beneath it.
4. **Overrides**: every create request (root, intermediate, issuing CA)
   takes overrides of the defaults (subject, validity, key, path length,
   key usage, EKU, name constraints, URLs, list validity); the service
   checks them, the signer enforces the invariants, the audit log
   records what changed.
5. **Ceremonies**: a two-tier root signs issuing CAs; a direct root
   generates leaf keys and signs leaves from a profile that lists its
   extensions exactly (SKI and AKI only for the bespoke consumer), and
   escrows the keys by default.
6. **Escrow** as a profile setting (default on) for every generated key,
   with a per-certificate override where the profile allows it.
7. **Screens**: the dashboard; CAs (the roots, each root's tree, chain,
   constraints, issuing window and list status); new root, ceremonies;
   certificates (search, detail, issue, revoke, download, export an
   escrowed key); profiles (read-only at first); audit (filters, export,
   the chain's verification status).
8. **The three roots** (ADR 0032), created through the console once their
   names and settings are agreed: Primary and Dev (three tiers, with their
   intermediates and issuing CAs), and the bespoke root (direct). Their
   certificates go to the relying parties that need them; nothing
   migrates yet.

**Sign-off:** C11.1–C11.4, C11.6, C13.5–C13.10, C16.4, C4.8.

## Phase 6 — Renewal, deploy targets and endpoint checks

1. The `9443` listener (HTTPS, client certificate requested, not
   required); `POST /v1/renew`: a current, unrevoked certificate from the
   same issuer, a CSR or none (keeping the key, within `maxKeyAge`), the
   same subject and profile back.
2. `@ncfritz/olympus-client` reloads a renewed certificate without a
   restart (today the key is read once at start), and a renewal helper
   the agents run on a schedule at two-thirds of the certificate's life.
3. **Deploy targets** (`deploy_targets`, `deployments`): a host path and
   an nginx reload, DSM through its API, the printer through its
   embedded web server; run on issue and renewal, retried, audited.
4. **Endpoint checks** (`endpoint_observations`): after a deploy and on
   a schedule, connect to the endpoint and record the certificate it
   serves; deployed-versus-issued in the API and a metric.
5. Alerts on `certificate_expiry_days` below the profile's threshold for
   anything not renewed automatically, and on a failed deploy.

**Sign-off:** C9, C16.3.

## Phase 7 — ACME

1. **Schema**: `acme_accounts`, `acme_eab_credentials`,
   `acme_name_policies`, `acme_orders`, `acme_authorizations`,
   `acme_challenges`, `acme_nonces`.
2. **Protocol** on `9443`: directory, `newNonce`, `newAccount` (EAB
   required), `newOrder`, authorizations, challenges, `finalize`,
   certificate download, `revokeCert`, account key rollover, and ACME
   Renewal Information (RFC 9773). JWS with `jose` (ES256, ES384, RS256,
   EdDSA).
3. **Policy**: an order's names checked against its account's name
   policy before any challenge exists; at `finalize`, a CSR carrying an
   existing enrollment's key is that enrollment's renewal only if the
   names and profile match.
4. **Challenges**: `http-01` and `tls-alpn-01`, validated from the
   `harpocrates` container. First confirm that container reaches port 80
   and 443 on the Mac Mini's LAN address, the NAS and a host outside
   Docker.
5. **Interop**: certbot, lego, acme.sh and Caddy against the dev stack,
   in containers, as a test task, including key reuse and ARI.
6. **First consumers**: the Mac Mini nginx's `olympus.internal` and
   `api.olympus.internal` certificates; the NAS's DSM certificate through
   acme.sh's Synology deploy hook.

**Sign-off:** C10, C11.5.

## Phase 8 — The migration from XCA

1. **Trust both**: the Primary root beside XCA's on every relying party;
   the API's `TLS_CA_SERVICES`, `TLS_CRL_SERVICES` and
   `AUTH_SERVICES_ISSUER` naming both Service issuing CAs and their
   chains' lists; the NAS pull for both.
2. **An inventory of XCA's certificates** (from its exports, outside
   Harpocrates) with a column for what replaces each.
3. **Replace**: ACME (phase 7) for every holder that speaks it; the rest
   reissued from the new CAs, by hand or through deploy targets (phase
   6): the agents' client certificates, the listeners' server
   certificates, people's devices, the printer.
4. **Retire XCA** once nothing trusts a certificate it issued: its root
   out of the trust stores, its lists' pull removed, its database
   archived encrypted beside the offline media.

**Sign-off:** C8, C5.4, C6, C4.7, C12.

## Phase 9 — SSH certificates

1. **Signer**: `sign/ssh` (user and host certificates, Ed25519 CA keys)
   and `sign/krl`; the invariants: a CA signs only its own kind, within
   its maximum validity.
2. **CAs**: the SSH User CA and SSH Host CA; rotation by a new
   generation trusted beside the old.
3. **Profiles**: `ssh-user` (principals from the operator's identity,
   16 hours) and `ssh-host` (hostnames, 90 days, renewed over mTLS);
   keys under the same uniqueness as X.509.
4. **Revocation**: a KRL per CA, published at `/krl/<slug>.krl`, and a
   schedule for hosts to fetch it (`RevokedKeys`).
5. **Console**: issue, revoke, current user certificates, and the
   `TrustedUserCAKeys` and `@cert-authority` lines to install.
6. **First consumers**: the Mac Mini, the NAS and the laptop.

**Sign-off:** C15.

## Follow-ups

Loose ends from phase 0, to close on the Mac before phase 4 at the latest:

- [ ] `pnpm install` on the Mac: the lockfile changes were made on Linux.
- [ ] Add `intermediate-2.crl` to `TLS_CRL_SERVICES` in the API's own
      `dev.env` and `local.env`, which are not in git.
- [ ] Run `scripts/dev-ca.sh --force` with macOS's `openssl` (LibreSSL);
      it was checked with OpenSSL 3 only.
- [ ] Build the `harpocrates-signer` image on the Mac Mini
      (`docker buildx bake harpocrates`); it has never been built.
- [ ] `apps/api/openapi/olympus.json` is stale on `main` (the `/auth/me`
      and `/auth/sessions` endpoints); regenerate it, apart from this work.

From phase 2:

- [ ] External CAs: a signer endpoint that makes a CSR for a key it
      holds, then `pending` issuers and the certificate coming back.
- [ ] The Debian weak-key blocklist (`openssl-blacklist` and
      `openssh-blacklist` fingerprints) in the key checks.
- [ ] A sweep for generated keys with no certificate after a day.
- [ ] Run `pnpm test:e2e` in CI, with a Postgres service and `uv`.

From phase 3:

- [ ] Revoking a CA: `POST /issuer/{id}/revoke`, the parent's next list
      (a ceremony for an offline parent) carrying it, and the console
      offering reissue from a successor (ADR 0020).
- [ ] Load `monitoring/harpocrates.rules.yml` in the monitoring stack's
      Prometheus and scrape the service as job `harpocrates`.
- [ ] `brew install prometheus` on the Mac, for `check:alerts`.
- [ ] Install the NAS pull (`infra/nas/README.md`) in phase 8.

From phase 4:

- [ ] Deploy the empty stack and initialise it (phase 4, C1.2).
- [ ] Before the root ceremonies (phase 5), agree each CA's name and
      settings, including the TLS CA's LAN range (`192.168.15.0/24`)
      and the Signing CA's mail domains (`ncfritz.net`).
- [ ] Build and push the images; neither Harpocrates image has been
      built yet:
      `docker buildx bake harpocrates services --push`.
- [ ] The internal DNS record `pki.internal.ncfritz.net`.

- [ ] Run the outstanding DEV sign-offs: phase 1 (C1, C2, C13.1–C13.4),
      phase 2 (C3, C4.1–C4.6, C7, C14) and phase 3 (C5, C6.1,
      C16.1–C16.2).

From the merge with `main` (2026-10-09):

- [x] Server certificates: decided in ADR 0032 (Proposed), a Server
      issuing CA of their own under the Primary root; the `api-server`
      profile moves to it in phase 5, and `TLS_SERVER_ISSUER` changes
      in phase 8.
- [ ] ADR 0031 (Proposed): when Control deploys releases rather than a
      checkout, `nginx/pki.conf` and the `harpocrates` stack move with
      it, and its pre-issued certificate pairs are phase 6's renewal.

## Later

- SCEP for iOS device enrollment through a configuration profile.
- `dns-01`, once `_acme-challenge.internal.ncfritz.net` is delegated to
  something with an API.
- A hardware key store behind the signer's key interface, the root's
  first.
- Discovery: endpoint checks across the LAN, for certificates
  Harpocrates did not issue.
- A timestamping authority, if re-signing becomes a burden.
- Owner reminders through the Olympus notification agent.
- Name constraints on the Service and Device CAs at their
  successors.
- The `harpocrates` stack on a second host.
