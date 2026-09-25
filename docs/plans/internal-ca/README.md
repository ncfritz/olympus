# Internal CA: phased implementation plan

The implementation of [ADR 0020](../../decisions/0020-internal-certificate-authority.md).
Each phase ends in a working, deployable state and a functional sign-off
against [signoff.md](signoff.md). XCA stays authoritative until phase 4,
which retires it; until then everything runs against the dev CA. The
[capabilities review](capabilities.md) is the reasoning behind the
2026-09-25 amendments.

| Phase | Delivers                                                                          | Depends on                              | Sign-off flows                       |
| ----- | --------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| 0     | Scaffolding: both services, Python toolchain, dev CA, dev compose                 | —                                       | —                                    |
| 1     | The signer: key store, automatic unseal, signing, invariants, ceremonies          | 0                                       | C1 (DEV), C2, C13.1–C13.4            |
| 2     | Management core: CAs, profiles, keys and enrollments, issuance, escrow, audit     | 1; authentication phase 3 (`auth_time`) | C3, C4.1–C4.6, C7, C14               |
| 3     | Revocation lists and monitoring: scheduling, publication, relying parties, alerts | 2                                       | C5, C6.1 (DEV), C16.1–C16.2          |
| 4     | Production cutover from XCA, and XCA retired                                      | 3; Docker plan phase 3                  | C8, C1.2, C5.4, C6, C4.7, C12, C13.5 |
| 5     | Renewal over mutual TLS, deploy targets, endpoint checks                          | 4                                       | C9, C16.3                            |
| 6     | ACME, with ARI                                                                    | 4                                       | C10                                  |
| 7     | The console on Olympus Control                                                    | 2; console plan                         | C11, C16.4                           |
| 8     | SSH certificates                                                                  | 5                                       | C15                                  |
| Later | SCEP, `dns-01`, hardware keys, discovery, a timestamping authority                |                                         |                                      |

Phases 5 and 6 are independent. Phase 7 can start once phase 2's API
exists and grows with each phase after it; until then the API is driven
from its OpenAPI page and the break-glass CLI.

## Phase 0 — Scaffolding

1. **ADR 0020 accepted** (2026-09-25).
2. **`apps/harpocrates/signer`**: a FastAPI app with `pyproject.toml` managed by
   `uv`; `ruff` (lint and format), `pyright` (strict), `pytest`. A
   `package.json` whose `build`, `lint`, `test` and `openapi` scripts
   call them, so `pnpm turbo run build lint test` covers it like any
   other package. The Docker image builds in the central build (ADR
   0011).
3. **`docs/conventions/python.md`**: the rules for the signer, in the
   shape of the other convention documents, and `CLAUDE.md` pointing at
   it for `apps/harpocrates/signer`.
4. **`apps/harpocrates/service`**: a NestJS app on the shared packages
   (`@ncfritz/olympus-nest`: config, logger, metrics), Prisma for its
   database, an `openapi` task writing `apps/harpocrates/service/openapi/harpocrates.json`, and
   `packages/sdk` generating a `harpocrates` client from it. A generated client
   for the signer's document, internal to `apps/harpocrates/service`.
5. **Dev CA**: `scripts/dev-ca.sh` takes production's three tiers (a
   root, two intermediates, the issuing CAs beneath them) and adds a
   **TLS Issuing CA Dev**, name-constrained to `localhost` and
   `internal.localhost`; it writes every CA key as encrypted PKCS#8, the
   format the signer imports.
6. **Dev compose**: `apps/harpocrates/docker-compose.yml` runs
   `harpocrates-postgres` on its own port, beside the existing Postgres
   and Hasura; both services run from the workspace (`pnpm dev`), the
   signer on a socket in `apps/harpocrates/.run/` (git-ignored).

**Sign-off:** both services start, `/health` answers, the Turbo tasks
pass, and the SDK builds with an empty `harpocrates` client; no functional flows.

## Phase 1 — The signer

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

## Phase 4 — Production cutover from XCA

1. **The `harpocrates` stack** in `infra/docker/compose/harpocrates.yml`
   on ADR 0019's conventions (shared `x-service`, file secrets for the
   signer token and the Postgres password, pinned images), with
   `harpocrates-published` mounted into the nginx and `olympus` stacks
   read-only.
2. **nginx**: `pki.internal.ncfritz.net` serving the published directory
   over plain HTTP, and `/harpocrates/ca/api` on the control host
   proxied to the management API. The internal DNS record.
3. **Ceremony** (a guide, followed once and recorded):
   1. `initialise` the signer: the unseal key into `${SECRETS_DIR}` as
      `harpocrates_signer_unseal_key`, and it and the recovery
      passphrase into the password manager. Restart the stack and
      confirm it unseals by itself.
   2. Export every CA key from XCA as encrypted PKCS#8. Import the
      Service and Device CAs (online), and Issuing CA 1 and 2 - G1
      (online, closed); import the root and both intermediates as
      offline CAs (their certificates and CRL numbers; their keys stay
      on offline media and in the password manager). Delete every other
      exported file.
   3. Import every certificate the CAs have issued, with its serial, and
      their revocations, from the XCA database; each list's next number
      continues from XCA's last.
   4. In ceremonies: Intermediate CA 1 signs the new TLS CA, Intermediate
      CA 2 the new Signing CA (their keys generated in the signer, path
      length 0, name constraints per the ADR); each offline CA signs its
      list (13 months).
   5. Issue `harpocrates`'s own `9443` certificate from the TLS CA.
   6. Archive the XCA database; XCA is retired.
4. **Switch the relying parties** to the published lists: the API's
   `TLS_CRL_SERVICES`, the NAS pull job.
5. **Rewrite [the certificates guide](../../guides/certificates.md)** for
   the console, the ceremonies and the CLI.

**Sign-off:** C8, C1.2, C5.4, C6, C4.7, C12, C13.5.

## Phase 5 — Renewal, deploy targets and endpoint checks

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

## Phase 6 — ACME

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

**Sign-off:** C10.

## Phase 7 — The console on Olympus Control

`apps/harpocrates/console` (`@ncfritz/harpocrates-console`), on
`packages/console` (ADR 0021) and the SDK's `harpocrates` client:

1. **Wiring**: the Harpocrates property and its `ca` console in the
   registry, `/harpocrates/ca` and `/harpocrates/ca/api` in nginx on the
   control host, the `harpocrates-ca-console` bake target, the host's
   `CONTROL_CONSOLES`.
2. **Dashboard** (the front page): counts by state, a 90-day expiry
   timeline by issuer, what needs a person this month, issuing windows,
   each list's next update, the seal state and the last publication,
   the week's renewals, orders and failures, deployed-versus-issued.
3. **CAs**: the tree, with chain, constraints, issuing window and list
   status; the create wizard (root, internal, external) and ceremonies.
4. **Certificates**: search by subject, SAN, serial, issuer, status and
   expiry; expiry as time remaining, banded, with how it renews; detail
   with chain, extensions, key lineage and deploy targets; issue (a
   wizard driven by the profile), renew, revoke, download, export an
   escrowed key (with a reason and a recent sign-in).
5. **Profiles** (read-only at first); **ACME**: accounts, EAB
   credentials and their name policies, orders; **audit**: filters and
   export, and the chain's verification status.
6. The seal state on every page, and unseal for `pki-admin`.

**Sign-off:** C11, C16.4.

## Phase 8 — SSH certificates

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
