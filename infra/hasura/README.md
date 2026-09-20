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
Deployments run `hasura/graphql-engine:<version>.cli-migrations-v3`, which
applies migrations and metadata when the container starts
(`infra/docker/compose/dev.yml` does this locally).

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
