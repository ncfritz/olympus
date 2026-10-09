# 0013. Minerva calendar sync feeds Hasura over RabbitMQ

- **Status:** Accepted (integration details deferred)
- **Date:** 2026-09-18

## Context

`minerva-calendar-sync` is a standalone sync engine (NestJS API + web UI)
with its own stores (SQLite or Postgres via Prisma migrations). It publishes
changes through a transactional outbox to the `calendar.events` topic
exchange with routing keys `event.<action>`. Olympus's `minerva_*` tables in
Hasura were built for syncing a single calendar; the new engine handles
many.

## Decision

- Minerva calendar sync keeps its own stores and migrations. It is not moved
  onto Hasura.
- The Hasura `minerva_*` tables are authoritative **for Olympus** and are
  kept in sync by consuming Minerva's RabbitMQ messages.
- `minerva_meetings` is a sync target: overwrites from sync are expected,
  including over edits made through the Olympus API.
- Minerva is imported into the monorepo as its own app(s). Parts of its UI
  may later merge into the Olympus UX.

## Deferred

- Schema changes to `minerva_*` for multiple calendars. **Settled by
  [ADR 0028](0028-minerva-calendar-ownership.md):** meetings and notes
  carry a user, meetings the account they came from.
- Where the consumer runs (dedicated agent vs. API module). **Settled by
  ADR 0028:** the Olympus API consumes `calendar.events`.
- Shared message contract package, ordering/version guard, delete handling,
  and full resync. **Settled by ADR 0028**, but for ordering and version
  guards, which stay deferred: the contract is `@ncfritz/olympus-messages`
  with its JSON Schema; a delete writes the event's snapshot marked
  deleted; a resync is the agent's backfill, which the API asks for when an
  account is linked.
