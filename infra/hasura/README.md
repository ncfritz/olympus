# Hasura

The Hasura v2 project under version control (ADR 0006): the schema as
migrations, the metadata as files. One source, `olympus`, over the
`dionysus`, `minerva` and `olympus` Postgres schemas.

```
config.yaml                       CLI project (endpoint, directories)
migrations/olympus/               one directory per migration, up.sql and down.sql
  1789862400000_init/             the baseline: the schema on 2026-09-20
metadata/                         databases, tables, functions, the rest
```

## Environment

The CLI and the engine read these; nothing here holds a credential.

| Variable                      | What                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `HASURA_GRAPHQL_ENDPOINT`     | the engine, when it is not `http://localhost:8080`            |
| `HASURA_GRAPHQL_ADMIN_SECRET` | the admin secret                                              |
| `HASURA_GRAPHQL_DATABASE_URL` | the `olympus` source's connection string (read by the engine) |

## Pointing the CLI at an environment

`config.yaml` names `http://localhost:8080`, which is the laptop's own data
stack. Anything else is an override, and the CLI reads overrides from
`infra/hasura/.env` — gitignored, like every other env file. Putting the
admin secret there rather than on the command line keeps it out of `ps` and
out of shell history.

| Engine                  | `HASURA_GRAPHQL_ENDPOINT`                 | `HASURA_GRAPHQL_ADMIN_SECRET`            |
| ----------------------- | ----------------------------------------- | ---------------------------------------- |
| the laptop's data stack | `http://localhost:8080` (the default)     | that laptop's `hasura_admin_secret`      |
| `hasura-dev`            | `http://olympus.dev.ncfritz.net:8081`     | the Mac Mini's `hasura_dev_admin_secret` |
| production              | `http://127.0.0.1:8080`, on the Mini only | the Mac Mini's `hasura_admin_secret`     |

`hasura-dev` is published on the LAN (`LAN_BIND`) because the IDE runs on
another machine. Production's engine is bound to loopback, so applying to it
by hand means running the CLI on the Mac Mini — and usually shouldn't be
done at all: a schema change reaches production by deploying the Hasura
image, which carries `migrations/` and applies them at start (ADR 0019).

So a schema change goes to `hasura-dev` with the CLI, and to production with
an image.

## Day to day

```sh
cd infra/hasura
hasura migrate status --database-name olympus
hasura migrate apply --database-name olympus      # apply what is missing
hasura metadata apply                             # apply metadata/
hasura metadata export                            # write the server's metadata back
hasura migrate create <name> --database-name olympus   # a new, empty migration
```

A schema change is a migration plus, when it changes what Hasura tracks,
a metadata export. Both are committed together, and reviewed like code.
Deployments run our Hasura image (`infra/docker/hasura`), which carries
`migrations/` and `metadata/` and applies them when the container starts:
a schema change ships as an image, to `hasura-dev` first (ADR 0019). The
laptop runs the same image in its `data` stack (`infra/docker/stack.sh`).

## The baseline

`migrations/olympus/1789862400000_init` is the schema as it stood on
2026-09-20, taken with `pg_dump --schema-only`. It is the dump without its
`DROP` statements (it must never drop a populated database) and without
ownership, which belongs to the environment. `check_function_bodies` stays
off in its preamble, because the dump creates functions before the tables
they read. It applies to an empty PostgreSQL 16 database and `down.sql`
drops the three schemas.

The metadata was exported from the running engine and split into the CLI's
layout. The connection string is `from_env`, never the file.

On an existing database (the Mac Mini's), mark the baseline as already
applied instead of running it:

```sh
hasura migrate apply --database-name olympus --version 1789862400000 --skip-execution
```

After the first `hasura metadata apply`, run `hasura metadata export` once
and commit whatever the CLI normalizes, so later exports show only real
changes.

Applying migrations or metadata to the Mac Mini's engine is always a
manual step, taken by hand with the CLI above; nothing in the repository
does it for you.
