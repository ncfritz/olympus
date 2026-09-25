# Harpocrates

The internal certificate authority ([ADR 0020](../../docs/decisions/0020-internal-certificate-authority.md),
[plan](../../docs/plans/internal-ca/README.md)). Two processes, built,
versioned and deployed together:

| Package                                   | Language         | Does                                                                               |
| ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `service/` `@ncfritz/harpocrates-service` | NestJS, Prisma   | Management API, issuance policy, revocation lists, renewal and ACME                |
| `signer/` `@ncfritz/harpocrates-signer`   | Python (FastAPI) | Holds the private keys; generates keys, signs certificates and lists; nothing else |

The service reaches the signer over a Unix socket with a shared token;
the signer has no network listener. The service never sees a private key
except one it hands to the operator once.

## Ports

| Port   | What                                         |
| ------ | -------------------------------------------- |
| `3200` | The management API, `/health` and `/metrics` |
| `9443` | Renewal and ACME, over TLS (phases 5 and 6)  |
| `5433` | `harpocrates-postgres` in development        |

## Development

```sh
cd apps/harpocrates
docker compose up -d                          # harpocrates-postgres
cp service/dev.env.example service/dev.env
pnpm --filter @ncfritz/harpocrates-service dev
```

`.run/` holds the signer's socket and development store; it is
git-ignored.

## Naming

Components carry the domain's name (packages, images, containers, the
stack, volumes, secrets, the OpenAPI document, the SDK client, the proxy
path, metrics). What is written into certificates and tokens stays
functional: `pki.internal.ncfritz.net`, and the roles `pki-admin` and
`pki-operator`.
