# minerva-calendar-sync

Syncs Google and Microsoft 365 calendars into one store and publishes
every event change to RabbitMQ for Olympus (ADR 0013). Imported from the minerva-calendar-sync
repository with its history; laid out as an agent with a management
console (ADR 0016).

Calendar accounts belong to Olympus users (ADR 0028). Users connect,
claim and manage their accounts and calendars on the Olympus site, through
the Olympus API, which calls the agent on its services listener and
consumes `calendar.events` into each owner's Minerva. Availability is the
user's, worked out by the API from their meetings and the blocks and levels
they set (ADR 0029). The console stays as an operator's view, signed in
through Olympus: events, the signed-in user's availability (from the API),
sync runs and the outbox.

| Package                                  | Directory  | Port | What it is                                                          |
| ---------------------------------------- | ---------- | ---- | ------------------------------------------------------------------- |
| `@ncfritz/minerva-calendar-sync-agent`   | `agent/`   | 4432 | Sync engine, provider webhooks, outbox publisher and management API |
| `@ncfritz/minerva-calendar-sync-console` | `console/` | 4392 | Next.js + AntD management UI                                        |

```
Google Calendar ─┐  polling / push   ┌──────────────┐  outbox   RabbitMQ
Microsoft Graph ─┴─────────────────▶ │    agent     │ ────────▶ calendar.events
                                     │  (Prisma DB) │           event.<action>
                    management API ▲ └──────────────┘
                                   │
                              console (browser)
```

## The agent's HTTP surface

- **Management API** under `/v1`, for the console and the Olympus API: on
  the API conventions (`docs/conventions/api.md`), one
  `<OperationId>Controller.ts` per operation, request and response shapes
  in `agent/src/model`. On the HTTP listener every operation needs an
  Olympus access token with the `admin` role (ADR 0029), checked with the
  keys the API publishes at `{OLYMPUS_API_URL}/.well-known/jwks.json`; the
  console signs in through the API as `minerva-calendar-console`, and the
  agent keeps its tokens in httpOnly cookies and refreshes them. On the services
  listener (`SERVICES_LISTEN_PORT`, ADR 0028) the caller is the client
  certificate's service, `olympus-api` by default; operations marked
  `@ServicesOnly()` (the web sign-ins and account removal) answer only
  there.
- **Syncing**: a full sync covers a window, `SYNC_WINDOW_PAST_DAYS` back
  (30) and `SYNC_WINDOW_FUTURE_DAYS` ahead (180), and runs again once a
  day; between them, incremental syncs. `SyncCalendar` (the console's
  Sync now) syncs a calendar now. `FullSyncCalendar` (Full sync) reads its
  whole history, from 1970 to the window's end, refused while it is
  syncing; later syncs go back to the window and leave older events alone.
- **OpenAPI document**: `pnpm openapi` writes
  `agent/openapi/minerva-calendar-sync.json` (committed; `check:openapi`
  and `lint:openapi` guard it, and the console generates its client from
  it). With `ENABLE_API_EXPLORER=true`, or outside production, the agent
  serves it at `/api-spec` (Swagger UI) and `/api-spec-json`.
- **Callbacks**, unversioned and outside the document because their paths
  are registered elsewhere: the console's sign-in, `/auth/login/:provider`
  and `/auth/callback` (with the Olympus API's client registry), and
  `/webhooks/google`, `/webhooks/microsoft` (with the providers).
- **The console's availability** is the signed-in user's, in Olympus
  (ADR 0029): the console calls the API's availability operations through
  the agent at `/olympus/v1/minerva/...`, which forwards exactly those, as
  the user, and nothing else.
- **The API's dead letters** (ADR 0028, amended): the Publish page shows
  the calendar events the API could not write, and why, and redrives them,
  through the same forwarding (`DescribeCalendarEventDeadLetters`,
  `RedriveCalendarEventDeadLetters`; admin).
- **Metrics** at `/metrics` (Prometheus, ADR 0017): Node's defaults,
  `http_server_request_duration_seconds` for the management API (by
  caller, from `X-Olympus-Client`, and operation), and the agent's own
  `sync_runs_total`, `sync_run_duration_seconds`,
  `sync_event_changes_total`, `outbox_publishes_total` and
  `webhook_notifications_total` (`agent/src/metrics/agentMetrics.ts`).

Every event change is published to `calendar.events` with routing key
`event.upsert`, `event.delete` or `event.backfill`; the contract
(`CalendarEventMessage`, and a JSON Schema for other languages) is in
`@ncfritz/olympus-messages`.

## Development

Run from the repository root (`pnpm install` once):

- `pnpm --filter @ncfritz/minerva-calendar-sync-agent dev`: the agent in
  watch mode, configured from `agent/dev.env` (see `agent/dev.env.example`).
- `pnpm --filter @ncfritz/minerva-calendar-sync-console dev`: the console
  on port 4392, pointed at the agent by `console/.env.local`
  (`NEXT_PUBLIC_API_URL`, see `console/.env.local.example`).

The store is SQLite by default (`DATABASE_URL="file:./dev.db"`); Postgres
uses the second schema in `agent/prisma/postgres` (`docker compose up -d
postgres` here starts one). Both schemas must stay identical; a test checks
it. `dev`, `start`, `start:debug` and `start:local` apply pending
migrations first (`scripts/migrate.mjs`, the schema chosen from
`DATABASE_URL`), so a new `dev.db` gets its tables; `pnpm migrate` does
just that step.

OAuth credentials the calendar connectors store (`agent/.credentials*/`)
and the SQLite files are git-ignored. When moving from the old repository,
copy `apps/api/.env`, `apps/api/.credentials*/` and `apps/api/prisma/dev.db`
into `agent/` (renaming `.env` to `dev.env`), and `apps/web/.env.local`
into `console/`. Variables renamed on the way: `PORT` → `LISTEN_PORT`;
`RABBITMQ_URL` → `OUTBOX_ENABLED=true` plus `AMQP_HOST`, `AMQP_PORT`,
`AMQP_USER`, `AMQP_PASSWORD`, `AMQP_VHOST`; `RABBITMQ_OUTBOX_*` →
`OUTBOX_*`; `RABBITMQ_EXCHANGE` is gone (the exchange is part of the
message contract).

Prisma downloads its engines from `binaries.prisma.sh` on install.

Tests (`pnpm test` in `agent/`): unit tests in `test/unit`, the
application over HTTP in `test/e2e`, and the convention checks in
`test/conventions`; `pnpm test:integration` runs the store against the
Postgres of `docker-compose.yml`.
