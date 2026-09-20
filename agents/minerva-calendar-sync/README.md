# minerva-calendar-sync

Syncs Google and Microsoft 365 calendars into one store, works out
availability (with manual overrides), and publishes every event change to
RabbitMQ for Olympus (ADR 0013). Imported from the minerva-calendar-sync
repository with its history; laid out as an agent with a management
console (ADR 0016).

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

## Development

Run from the repository root (`pnpm install` once):

- `pnpm --filter @ncfritz/minerva-calendar-sync-agent dev`: the agent in
  watch mode, configured from `agent/.env` (see `agent/.env.example`).
- `pnpm --filter @ncfritz/minerva-calendar-sync-console dev`: the console
  on port 4392, pointed at the agent by `console/.env.local`
  (`NEXT_PUBLIC_API_URL`, see `console/.env.local.example`).

The store is SQLite by default (`DATABASE_URL="file:./dev.db"`); Postgres
uses the second schema in `agent/prisma/postgres` (`docker compose up -d
postgres` here starts one). Both schemas must stay identical; a test checks
it.

OAuth credentials the calendar connectors store (`agent/.credentials*/`)
and the SQLite files are git-ignored. When moving from the old repository,
copy `apps/api/.env`, `apps/api/.credentials*/` and `apps/api/prisma/dev.db`
into `agent/`, and `apps/web/.env.local` into `console/`.

Prisma downloads its engines from `binaries.prisma.sh` on install.
