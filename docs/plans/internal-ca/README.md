# Internal CA: phased implementation plan

The implementation of [ADR 0020](../../decisions/0020-internal-certificate-authority.md).
Each phase ends in a working, deployable state and a "done when" that is
checked before the next begins. XCA stays authoritative until phase 4;
until then everything runs against the dev CA.

| Phase | Delivers                                                          | Depends on             |
| ----- | ----------------------------------------------------------------- | ---------------------- |
| 0     | Scaffolding: both services, Python toolchain, dev CA, dev compose | —                      |
| 1     | The signer: key store, seal, signing, invariants, escrow          | 0                      |
| 2     | Management core: issuers, profiles, issuance, revocation, audit   | 1                      |
| 3     | Revocation lists: scheduling, publication, relying parties        | 2                      |
| 4     | Production cutover from XCA                                       | 3; Docker plan phase 3 |
| 5     | Renewal over mutual TLS                                           | 4                      |
| 6     | ACME                                                              | 4                      |
| 7     | The PKI area in the site                                          | 2; roadmap phase 3     |
| Later | SCEP, `dns-01`, OCSP, ARI, hardware keys                          |                        |

Phases 5 and 6 are independent. Phase 7 can start as soon as the site is
imported and grows with each phase after 2; until then the API is driven
from its OpenAPI page and the break-glass CLI.

## Phase 0 — Scaffolding

1. **ADR 0020 accepted.**
2. **`apps/pki-signer`**: a FastAPI app with `pyproject.toml` managed by
   `uv`; `ruff` (lint and format), `pyright` (strict), `pytest`. A
   `package.json` whose `build`, `lint`, `test` and `openapi` scripts
   call them, so `pnpm turbo run build lint test` covers it like any
   other package. The Docker image builds in the central build (ADR
   0011).
3. **`docs/conventions/python.md`**: the rules for the signer, in the
   shape of the other convention documents, and `CLAUDE.md` pointing at
   it for `apps/pki-signer`.
4. **`apps/pki`**: a NestJS app on the shared packages
   (`@ncfritz/olympus-nest`: config, logger, metrics), Prisma for its
   database, an `openapi` task writing `apps/pki/openapi/pki.json`, and
   `packages/sdk` generating a `pki` client from it. A generated client
   for the signer's document, internal to `apps/pki`.
5. **Dev CA**: `scripts/dev-ca.sh` adds an **Internal TLS Dev**
   intermediate, name-constrained to `localhost` and
   `internal.localhost`, and writes the intermediates' keys as encrypted
   PKCS#8, the format the signer imports.
6. **Dev compose**: `pki-postgres` alongside the existing Postgres and
   Hasura; both services run from the workspace (`pnpm dev`), the signer
   on a socket in a git-ignored directory.

**Done when** both services start, `/health` answers, the Turbo tasks
pass, and the SDK builds with an empty `pki` client.

## Phase 1 — The signer

1. **Key store**: SQLite on the signer's volume. Per-key data keys
   (AES-256-GCM), wrapped by a key-encryption key from Argon2id over the
   passphrase; a check value to reject a wrong passphrase.
2. **Seal**: `status`, `unseal`, `seal`; sealed at start; every signing
   operation `503` while sealed. `initialise` sets the passphrase on an
   empty store and refuses on a populated one.
3. **Keys**: generate P-256 and RSA 2048 (subject keys only); import
   encrypted PKCS#8 (the XCA intermediates); public keys out, never
   private ones.
4. **Signing**: `sign/certificate` from a fully formed request (subject,
   SANs, extensions, validity, serial, and a public key, a CSR, or a key
   id); `sign/crl` from an issuer, number, this and next update and the
   revoked entries.
5. **Invariants**: the issuer's name constraints over every name, a
   maximum validity and the issuer's own expiry, the issuer's allowed
   extended key usages, `CA:TRUE` refused.
6. **Escrow**: generated keys kept wrapped; `escrow/export` as PEM or
   PKCS#12, modern (AES-256, PBKDF2) or legacy (SHA-1, 3DES; no chain)
   for `legacy-device`.
7. **Transport**: Uvicorn on a Unix socket; the shared token; no TCP
   listener in any configuration.
8. **CLI** (`python -m pki_signer`): `initialise`, `unseal`, `seal`,
   `status`.
9. **Tests**: every certificate and CRL produced is parsed back and
   verified against its issuer with `cryptography` and with `openssl
verify` / `openssl crl -verify`; each invariant has a refusal test;
   seal and unseal, wrong passphrase, a restart forgetting keys.

**Done when** a certificate signed by the dev Services intermediate
through the signer is accepted by the API's `3443` in the existing
handshake test, and each invariant's refusal is covered.

## Phase 2 — Management core

1. **Schema** (Prisma migrations): `issuers`, `profiles`, `certificates`,
   `revocations`, `crls`, `enrollments`, `escrow_exports`,
   `audit_events`. Foreign keys and constraints throughout; a unique
   serial per issuer.
2. **Issuers**: import an intermediate (certificate and chain, key to the
   signer); record its name constraints, allowed usages, maximum
   validity and the distribution URLs it writes into certificates.
3. **Profiles**: the ADR's initial set, seeded; the rules applied before
   anything reaches the signer.
4. **Issuance**: 159-bit random serials in the certificate's
   transaction; CSR enrollment (signature and profile checks) and
   generated enrollment (escrowed key); certificate download as PEM,
   chain, and PKCS#12 where the key is escrowed.
5. **Revocation**: revoke with a reason; status on the certificate; an
   escrowed key deleted on revocation.
6. **Auth**: JWTs verified against the API's JWKS (`kid`, `aud`), roles
   `pki-admin` and `pki-operator`; escrow export requires a recent
   sign-in, which needs an `auth_time` claim added to the API's access
   tokens (a change to the ADR 0018 token service, made there).
7. **Audit**: every issuance, revocation, export, unseal and seal, with
   the principal and a reason where one is required.
8. **Metrics**: `pki_signer_sealed`, `pki_certificates_issued_total{issuer,profile}`,
   `pki_revocations_total{issuer,reason}`, `certificate_expiry_days`
   per certificate the CA knows of.
9. **Break-glass CLI** in the `pki` image: `issue`, `revoke`, `status`,
   running against the database and the signer without the API.

**Done when** a service and a device certificate are issued (one by CSR,
one generated and escrowed), exported, and revoked through the OpenAPI
page against the dev CA, with an audit event for each.

## Phase 3 — Revocation lists

1. **Scheduling**: a list per issuer, numbered monotonically, valid 7
   days, signed daily and on every revocation; retries while sealed.
2. **Publication**: DER list and issuer certificate written to the
   published directory (a volume in compose), fetched back through the
   distribution URL and verified, then recorded as published.
3. **The root's list**: upload, verify against the root, publish.
4. **The API**: `TLS_CRL_SERVICES` pointed at the published Services and
   root lists (dev first). No code change: it already reloads on change.
5. **The NAS**: a pull script in `infra/` (fetch, verify both lists,
   concatenate, swap the file, `nginx -s reload`) and its schedule.
6. **Alerts**: sealed longer than 10 minutes; a publication failed; a
   published list within 2 days of its next update.

**Done when** revoking a dev agent certificate makes the API refuse its
next handshake without anyone touching a file, and a revoked device
certificate is refused by the border nginx after one pull (in dev once
authentication phase 6 provides it).

## Phase 4 — Production cutover from XCA

1. **The `pki` stack** in `infra/docker/compose/pki.yml` on ADR 0019's
   conventions (shared `x-service`, file secrets for the signer token and
   the Postgres password, pinned images), with `pki-published` mounted
   into the nginx and `olympus` stacks read-only.
2. **nginx**: `pki.internal.ncfritz.net` serving the published directory
   over plain HTTP, and `/pki` on the site's host proxied to the
   management API. The internal DNS record.
3. **Ceremony** (a guide, followed once and recorded):
   1. `initialise` the signer; the passphrase into the password manager.
   2. Generate the Internal TLS key in the signer; its CSR out.
   3. In XCA, sign it with the root: path length 0, key usage
      `Certificate Sign` and `CRL Sign`, name constraints permitting
      `internal.ncfritz.net` and the LAN's ranges. Import the
      certificate.
   4. Export the Olympus Services and Olympus Devices keys from XCA as
      encrypted PKCS#8; import them; delete the exported files.
   5. Import every certificate the two intermediates have issued, with
      its serial, and their revocations, from the XCA database; the
      next list number continues from XCA's last.
   6. Issue `pki`'s own `9443` certificate from Internal TLS.
   7. Sign the root's list in XCA (13 months) and upload it.
4. **Switch the relying parties** to the published lists: the API's
   `TLS_CRL_SERVICES`, the NAS pull job.
5. **Rewrite [the certificates guide](../../guides/certificates.md)** for
   the UI and the CLI; XCA remains for the root and its list.

**Done when** the first production lists are published with numbers
above XCA's, the API and the NAS load them, a test certificate is issued
and revoked in production, and XCA's intermediate keys are no longer
used.

## Phase 5 — Renewal

1. The `9443` listener (HTTPS, client certificate requested, not
   required); `POST /v1/renew`: a current, unrevoked certificate from the
   same issuer, a CSR or none (escrowed key), the same subject and
   profile back.
2. `@ncfritz/olympus-client` reloads a renewed certificate without a
   restart (today the key is read once at start), and a renewal helper
   the agents run on a schedule at two-thirds of the certificate's life.
3. Alerts on `certificate_expiry_days` below 30 for anything not renewed
   automatically (the printer).

**Done when** a dev agent renews its own certificate and keeps calling
the API without a restart.

## Phase 6 — ACME

1. **Schema**: `acme_accounts`, `acme_eab_credentials`,
   `acme_name_policies`, `acme_orders`, `acme_authorizations`,
   `acme_challenges`, `acme_nonces`.
2. **Protocol** on `9443`: directory, `newNonce`, `newAccount` (EAB
   required), `newOrder`, authorizations, challenges, `finalize`,
   certificate download, `revokeCert`, account key rollover. JWS with
   `jose` (ES256, ES384, RS256, EdDSA).
3. **Policy**: an order's names checked against its account's name
   policy before any challenge exists.
4. **Challenges**: `http-01` and `tls-alpn-01`, validated from the `pki`
   container. First confirm that container reaches port 80 and 443 on
   the Mac Mini's LAN address, the NAS and a host outside Docker.
5. **Interop**: certbot, lego, acme.sh and Caddy against the dev stack,
   in containers, as a test task.
6. **First consumers**: the Mac Mini nginx's `olympus.internal` and
   `api.olympus.internal` certificates; the NAS's DSM certificate through
   acme.sh's Synology deploy hook.

**Done when** all four clients obtain, renew and revoke against dev, and
the Mac Mini nginx renews its production certificate unattended.

## Phase 7 — The PKI area in the site

After the site import (roadmap phase 3), on the SDK and `packages/ui`:

1. The seal state on every page of the area, and unseal for `pki-admin`.
2. Issuers: chain, constraints, current list and its next update.
3. Certificates: search by subject, SAN, serial, issuer, status and
   expiry; detail with chain and extensions; issue (a wizard driven by
   the profile), renew, revoke, download, export an escrowed key (with a
   reason and a recent sign-in).
4. Profiles (read-only at first).
5. ACME: accounts, EAB credentials and their name policies, orders.
6. The audit log.

**Done when** every action in the certificates guide can be done from the
UI.

## Later

- SCEP for iOS device enrollment through a configuration profile.
- `dns-01`, once `_acme-challenge.internal.ncfritz.net` is delegated to
  something with an API.
- OCSP, if a relying party that isn't ours needs it.
- ACME Renewal Information (RFC 9773).
- A hardware key store behind the signer's key interface.
- Name constraints on Olympus Services and Olympus Devices at their
  renewal.
- The `pki` stack on a second host.
