# @ncfritz/harpocrates-signer

The one process that holds Harpocrates's private keys
([ADR 0020](../../../docs/decisions/0020-internal-certificate-authority.md)).
It generates keys and signs certificates and revocation lists from fully
formed requests, enforcing its own invariants; the service decides
everything else. Python, by the rules in
[python.md](../../../docs/conventions/python.md).

It serves HTTP on a Unix socket only, with no TCP listener in any
configuration. `/health` answers there; the rest of the API arrives with
phase 1 of the [plan](../../../docs/plans/internal-ca/README.md).

## Commands

```sh
python -m harpocrates_signer serve [--reload]   # the API on SIGNER_SOCKET_PATH
python -m harpocrates_signer health             # exit 0 if it answers (Docker)
python -m harpocrates_signer openapi [dir]      # write dir/signer.json
```

Through the workspace: `pnpm dev`, `pnpm start` (both read `dev.env`),
and the Turbo tasks `build lint typecheck test openapi check:conventions`.

## Environment

| Variable             | Default | Meaning                                |
| -------------------- | ------- | -------------------------------------- |
| `SIGNER_SOCKET_PATH` | —       | The Unix socket to serve on (required) |
| `SIGNER_LOG_LEVEL`   | `INFO`  | `DEBUG`, `INFO`, `WARNING` or `ERROR`  |

The image is `infra/docker/python/Dockerfile`, target `harpocrates-signer`
in `/docker-bake.hcl`.
