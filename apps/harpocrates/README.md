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

Needs [uv](https://docs.astral.sh/uv/) on the PATH for the signer (it
installs the Python version itself); the rules are
[python.md](../../docs/conventions/python.md).

```sh
cd apps/harpocrates
docker compose up -d                          # harpocrates-postgres
cp service/dev.env.example service/dev.env
cp signer/dev.env.example signer/dev.env
pnpm --filter "@ncfritz/harpocrates-*" dev    # both, from the workspace
curl --unix-socket .run/signer.sock http://signer/health
```

`.run/` holds the signer's socket and development store; it is
git-ignored.

The signer's API document is committed (`signer/openapi/signer.json`),
and so is the service's client for it (`service/src/generated/signer`),
so building the service never needs Python. After changing the signer's
API:

```sh
pnpm --filter @ncfritz/harpocrates-signer openapi
pnpm --filter @ncfritz/harpocrates-service generate:signer
```

`check:conventions` fails on either until both are current.

## Naming

Components carry the domain's name (packages, images, containers, the
stack, volumes, secrets, the OpenAPI document, the SDK client, the proxy
path, metrics). What is written into certificates and tokens stays
functional: `pki.internal.ncfritz.net`, and the roles `pki-admin` and
`pki-operator`.
