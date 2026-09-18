# 0006. Database schema and Hasura metadata under version control

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The Postgres schema and Hasura metadata exist only in the running instance.
There is no migration history and referential integrity is incomplete:
relationships such as meeting → attendees → user are configured in Hasura
rather than backed by foreign keys.

## Decision

1. **Baseline.** Export the current schema and metadata into
   `infra/hasura/` (`hasura migrate create init --from-server`,
   `hasura metadata export`).
2. **Every change is a migration.** Schema changes are written as SQL
   migrations in `infra/hasura/migrations/`. Metadata changes are committed
   from `infra/hasura/metadata/`. No console-only changes.
3. **Deploy by image.** Hasura runs from the
   `graphql-engine:<v2 LTS>.cli-migrations-v3` image with migrations and
   metadata mounted, which applies both on container start.
4. **Referential integrity.** Run orphan-row audit queries first, clean up
   or quarantine bad rows, then add foreign keys, `NOT NULL` and `CHECK`
   constraints as migrations. Hasura relationships are then derived from
   the foreign keys rather than configured by hand.
5. **Metadata from the schema.** A script tracks new tables and creates
   foreign-key relationships after migrations run, and writes the metadata
   back to the repo. Hand-written metadata is reserved for exceptions.

## Consequences

- The database can be recreated from the repo, which enables integration
  tests against a disposable Postgres + Hasura (ADR 0010).
- Adding an entity costs one migration, one metadata-generation command,
  and the model/API code (ADR 0007, 0009).
- The foreign-key rollout may surface existing bad data that has to be
  resolved first.
