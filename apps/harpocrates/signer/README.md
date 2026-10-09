# @ncfritz/harpocrates-signer

The one process that holds Harpocrates's private keys
([ADR 0020](../../../docs/decisions/0020-internal-certificate-authority.md)).
It generates keys and signs certificates and revocation lists from fully
formed requests, enforcing its own invariants; the service decides
everything else. Python, by the rules in
[python.md](../../../docs/conventions/python.md).

It serves HTTP on a Unix socket only, with no TCP listener in any
configuration, and every route but `/health` needs the shared token
(`Authorization: Bearer`). The API is `openapi/signer.json`; the service
calls it through a generated client.

## What it holds

- **The store** (`SIGNER_STORE_PATH`, SQLite): every private key under
  its own data key (AES-256-GCM), the data keys under a master key, and
  the master key wrapped twice: by the unseal key and by a key derived
  from the recovery passphrase (Argon2id). Nothing is written in the
  clear.
- **The seal**: at start the signer opens the master key with the unseal
  key (`SIGNER_UNSEAL_KEY_FILE`), so a restart needs nobody. Without it,
  or with the wrong one, it starts sealed; `seal` is recorded and
  survives restarts until `unseal` with the passphrase. Everything that
  signs answers `503` while sealed.
- **Online issuers**: issuing CAs (path length 0) whose keys it holds,
  each with its chain, maximum validity and the usages it may sign.
- **Ceremonies**: an offline CA's key (a root or an intermediate), held
  in memory for one ceremony, an hour at most, and never across a
  restart. Only a ceremony signs `CA:TRUE`.

## Invariants

Refusals answer `422` with the invariant's name:

| Invariant                       | Refused                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `name-constraints`              | a name outside a constraint of the issuer or any CA above it                                    |
| `extended-key-usage`            | a usage the issuer is not registered for, or outside an EKU up the chain                        |
| `validity`                      | past the issuer's expiry, longer than its maximum, or inverted                                  |
| `ca`                            | `CA:TRUE` from an online issuer                                                                 |
| `path-length`                   | a CA not strictly below its signer; an online issuer that is not 0                              |
| `subject-key`                   | an issuer's key as a subject's, a subject's as a CA's, or a destroyed one                       |
| `proof-of-possession`           | a CSR whose signature does not verify                                                           |
| `ceremony`                      | a ceremony asked to sign a leaf, or opened with a CA that signs no CAs                          |
| `escrow`                        | exporting an issuer's key, or with another key's certificate                                    |
| `issuer-key`, `chain`, `serial` | an issuer registered with the wrong key or a chain not its own; a serial outside 1 to 2^159 - 1 |

## Commands

```sh
python -m harpocrates_signer serve [--reload]   # the API on SIGNER_SOCKET_PATH
python -m harpocrates_signer health             # exit 0 if it answers (Docker)
python -m harpocrates_signer openapi [dir]      # write dir/signer.json

# Over the socket, with the token (break-glass, inside the container):
python -m harpocrates_signer status
python -m harpocrates_signer initialise          # prints the unseal key, once
python -m harpocrates_signer unseal              # the recovery passphrase
python -m harpocrates_signer seal
python -m harpocrates_signer rotate-unseal-key   # prints the new key, once
python -m harpocrates_signer change-passphrase
```

Passphrases are prompted for, never arguments. Through the workspace:
`pnpm dev`, `pnpm start` and `pnpm signer <command>` (all read
`dev.env`), and the Turbo tasks `build lint typecheck test openapi
check:conventions`.

## Environment

| Variable                          | Default | Meaning                                                          |
| --------------------------------- | ------- | ---------------------------------------------------------------- |
| `SIGNER_SOCKET_PATH`              | —       | The Unix socket to serve on                                      |
| `SIGNER_STORE_PATH`               | —       | The SQLite store                                                 |
| `SIGNER_TOKEN_FILE`               | —       | The shared token, at least 32 characters (a secret)              |
| `SIGNER_UNSEAL_KEY_FILE`          | unset   | The unseal key (a secret); unset, missing or empty: start sealed |
| `SIGNER_CEREMONY_TIMEOUT_SECONDS` | `3600`  | How long a ceremony may hold a key, 1 to 3600                    |
| `SIGNER_LOG_LEVEL`                | `INFO`  | `DEBUG`, `INFO`, `WARNING` or `ERROR`                            |

The image is `infra/docker/python/Dockerfile`, target `harpocrates-signer`
in `/docker-bake.hcl`; the stack is `infra/docker/compose/harpocrates.yml`,
where it has no network at all. The socket is created read-write for its
owner and group (uid and gid 10001) only, and the service joins that
group; the socket's directory is a volume mounted at the image's
`/run/service`.
