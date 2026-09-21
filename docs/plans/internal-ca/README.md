# Internal CA: phased implementation plan

The implementation of [ADR 0020](../../decisions/0020-internal-certificate-authority.md).
Each phase ends in a working, deployable state and a functional sign-off
against [signoff.md](signoff.md). XCA stays authoritative until phase 4;
until then everything runs against the dev CA.

| Phase | Delivers                                                          | Depends on                              | Sign-off flows                |
| ----- | ----------------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| 0     | Scaffolding: both services, Python toolchain, dev CA, dev compose | —                                       | —                             |
| 1     | The signer: key store, automatic unseal, signing, invariants      | 0                                       | C1 (DEV), C2                  |
| 2     | Management core: issuers, profiles, issuance, escrow, audit       | 1; authentication phase 3 (`auth_time`) | C3, C4.1–C4.6, C7             |
| 3     | Revocation lists: scheduling, publication, relying parties        | 2                                       | C5, C6.1 (DEV)                |
| 4     | Production cutover from XCA                                       | 3; Docker plan phase 3                  | C8, C1.2, C5.4, C6, C4.7, C12 |
| 5     | Renewal over mutual TLS                                           | 4                                       | C9                            |
| 6     | ACME                                                              | 4                                       | C10                           |
| 7     | The PKI area in the site                                          | 2; roadmap phase 3                      | C11                           |
| Later | SCEP, `dns-01`, OCSP, ARI, hardware keys                          |                                         |                               |

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

**Sign-off:** both services start, `/health` answers, the Turbo tasks
pass, and the SDK builds with an empty `pki` client; no functional flows.

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
   `status`, `rotate-unseal-key`, `change-passphrase`.
9. **Tests**: every certificate and CRL produced is parsed back and
   verified against its issuer with `cryptography` and with `openssl
verify` / `openssl crl -verify`; each invariant has a refusal test;
   automatic unseal, a missing or wrong unseal key, a deliberate seal
   surviving a restart, a wrong passphrase.

**Sign-off:** C1 (DEV), C2.

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
   sign-in, read from the access token's `auth_time` (ADR 0018,
   authentication phase 3).
7. **Audit**: every issuance, revocation, export, unseal and seal, with
   the principal and a reason where one is required.
8. **Metrics**: `pki_signer_sealed`, `pki_certificates_issued_total{issuer,profile}`,
   `pki_revocations_total{issuer,reason}`, `certificate_expiry_days`
   per certificate the CA knows of.
9. **Break-glass CLI** in the `pki` image: `issue`, `revoke`, `status`,
   running against the database and the signer without the API.

**Sign-off:** C3, C4.1–C4.6, C7.

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
6. **Alerts**: sealed longer than 10 minutes (the unseal key missing, or
   a deliberate seal); a publication failed; a
   published list within 2 days of its next update.

**Sign-off:** C5, C6.1 (DEV).

## Phase 4 — Production cutover from XCA

1. **The `pki` stack** in `infra/docker/compose/pki.yml` on ADR 0019's
   conventions (shared `x-service`, file secrets for the signer token and
   the Postgres password, pinned images), with `pki-published` mounted
   into the nginx and `olympus` stacks read-only.
2. **nginx**: `pki.internal.ncfritz.net` serving the published directory
   over plain HTTP, and `/pki` on the site's host proxied to the
   management API. The internal DNS record.
3. **Ceremony** (a guide, followed once and recorded):
   1. `initialise` the signer: the unseal key into `${SECRETS_DIR}` as
      `pki_signer_unseal_key`, and it and the recovery passphrase into
      the password manager. Restart the stack and confirm it unseals by
      itself.
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

**Sign-off:** C8, C1.2, C5.4, C6, C4.7, C12.

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

**Sign-off:** C9.

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

**Sign-off:** C10.

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

**Sign-off:** C11.

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
