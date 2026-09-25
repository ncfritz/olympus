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
  `code-signing`, `email`, `document`).
- **Keys, enrollments, certificates**: every key once, by its
  SubjectPublicKeyInfo hash; one enrollment (the request) per key; the
  key's certificates as its lineage, first issue and renewals.
- **Revocations, escrow exports** and **the audit log**: hash-chained,
  append-only (a trigger refuses updates and deletes).

## Rules it applies

- **Issuer choice**: the request's issuer, else the profile's pin, else
  the pinned CA's successor, else the one active CA of the profile's
  purpose whose usages cover the profile's. A CA stops issuing when its
  **issuing window** closes: its expiry less its longest certificate and
  30 days.
- **One key, one request**: a key already seen is reissued only for the
  same profile, subject and names, and refused (`409`) for anything else.
  A CA's key is never a subject's. Weak RSA keys (ROCA, close primes) are
  refused.
- **Renewal** reuses the key while it is younger than the profile's
  `maxKeyAgeDays`, and otherwise needs a new key: a CSR, or a generated
  one where the profile allows it. A new key is a new enrollment that
  replaces the old one.
- **Revocation** with `keyCompromise` revokes every certificate for the
  key and blocks it for good. An escrowed key is destroyed with its
  lineage's last valid certificate.

Refusals answer `422` and are audited; the signer's own refusals name
its invariant.

## API

`/v1`, with the API's access tokens (ADR 0018) and the roles
`pki-operator` and `pki-admin`. The document is
`openapi/harpocrates.json`; the SDK's `harpocrates` client is generated
from it.

| Operation                                                              | Who                   |
| ---------------------------------------------------------------------- | --------------------- |
| `GET /issuers`, `GET /issuer/{id}`                                     | either role           |
| `POST /issuers/roots`, `POST /issuers/import`                          | admin, recent sign-in |
| `POST /ceremonies`, `POST /ceremony/{id}/intermediates`, `.../issuing` | admin, recent sign-in |
| `GET /ceremony/{id}`, `DELETE /ceremony/{id}`                          | admin                 |
| `GET /profiles`, `GET /profile/{id}`                                   | either role           |
| `PUT /profile/{id}` (the issuer pin)                                   | admin                 |
| `POST /certificates`, `GET /certificates`, `GET /certificate/{id}`     | either role           |
| `GET /certificate/{id}/download` (`pem`, `der`, `chain`)               | either role           |
| `POST /certificate/{id}/renew`, `POST /certificate/{id}/revoke`        | either role           |
| `POST /certificate/{id}/key-export` (PEM, PKCS#12, legacy PKCS#12)     | admin, recent sign-in |
| `GET /signer/status`; `POST /signer/seal`, `POST /signer/unseal`       | either role; admin    |
| `GET /audit/events`, `GET /audit/verification`                         | either role           |

"Recent" is `AUTH_RECENT_SIGN_IN_SECONDS` since the token's `auth_time`.
`/health` and `/metrics` are open.

## Metrics

`harpocrates_certificates_issued_total{issuer,profile}`,
`harpocrates_revocations_total{issuer,reason}`,
`harpocrates_refusals_total{invariant}`,
`harpocrates_issuing_window_days{issuer}`, `harpocrates_signer_sealed`,
and `certificate_expiry_days{issuer,profile,subject,serial}` for every
valid certificate. The gauges are read at scrape time; a scrape never
fails because the database or the signer is down.

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
```

The e2e tests need `HARPOCRATES_E2E_DATABASE_URL`, a database they may
create and drop schemas in, and `uv` for the signer; without the URL
they are skipped. Each file builds a hierarchy (root, intermediate and
issuing CAs through ceremonies) in a fresh schema, with its own signer on
a temporary store, and checks the results with `openssl`:

```sh
HARPOCRATES_E2E_DATABASE_URL=postgresql://harpocrates:harpocrates@localhost:5433/harpocrates pnpm test:e2e
```

## Environment

| Variable                      | Default                           | Meaning                                                 |
| ----------------------------- | --------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                | —                                 | `harpocrates-postgres` (read by Prisma)                 |
| `LISTEN_PORT`                 | `3200`                            | The management API, `/health` and `/metrics`            |
| `SIGNER_SOCKET_PATH`          | —                                 | The signer's socket                                     |
| `SIGNER_TOKEN_FILE`           | —                                 | The shared token (a secret)                             |
| `AUTH_JWKS_URL`               | —                                 | The API's published keys; or                            |
| `AUTH_JWKS_FILE`              | —                                 | the same as a file (exactly one of the two)             |
| `AUTH_AUDIENCE`               | `olympus-api`                     | The tokens' audience                                    |
| `AUTH_RECENT_SIGN_IN_SECONDS` | `300`                             | How recent a sign-in ceremonies and escrow export need  |
| `PKI_REALM`                   | `ncfritz.net`                     | The prefix of CA names: `<realm> TLS Issuing CA 1 - G1` |
| `PKI_ORGANIZATION`            | `ncfritz.net`                     | `O=` in the names it issues                             |
| `PKI_DISTRIBUTION_URL`        | `http://pki.internal.ncfritz.net` | Where CRLs and CA certificates are published (phase 3)  |

Logging is the shared set (`LOKI_URL`, `CONSOLE_LOGGING_LEVEL`, ...) in
`dev.env.example`.
