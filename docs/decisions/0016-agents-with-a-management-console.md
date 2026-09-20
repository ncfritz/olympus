# 0016. Agents with a management console

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

`minerva-calendar-sync` is more than a message consumer. One NestJS process
syncs Google and Microsoft 365 calendars, receives the providers' push
notifications, publishes changes through a transactional outbox, and
serves a management API. A Next.js console uses that API to connect
accounts, choose calendars, set availability overrides and watch sync and
publish history. The two were built together in their own workspace.

ADR 0003 separates `apps/` (HTTP and UI) from `agents/` (RabbitMQ workers
with no inbound HTTP beyond health and metrics) and left Minerva's place
open. Other agents would benefit from the same kind of console for
management and troubleshooting, so the answer should be a pattern, not a
one-off.

## Decision

### Layout

An agent that has a console is one directory with two packages:

```
agents/<name>/
  README.md        how the parts fit, ports, environment
  agent/           @ncfritz/<name>-agent    the NestJS process
    openapi/       the management API document, generated and committed
  console/         @ncfritz/<name>-console  the Next.js management UI
```

The workspace includes `agents/*/agent` and `agents/*/console`. The two
packages are versioned, built and deployed together; the console talks only
to its own agent.

### The agent

- Follows the agent conventions (`docs/conventions/agent.md`, ADR 0015):
  feature folders, typed configuration, Nest's `Logger`, shared message
  contracts in `@ncfritz/olympus-messages`, tests under `test/`.
- Unlike a plain agent it has an inbound HTTP surface, limited to:
  - the **management API** for its console, behind the agent's own
    authentication;
  - **provider callbacks**: webhooks and OAuth redirect URIs. Their paths
    are registered with third parties, so they are stable, unversioned
    (`VERSION_NEUTRAL`) and answer in whatever form the provider expects;
  - health and metrics.
- The management API follows the API conventions
  (`docs/conventions/api.md`): one operation per controller class in
  `<OperationId>Controller.ts` with a `handle` method, URI version `1`,
  operation naming, decorator order, status codes and `ErrorResponse`
  errors, services behind thin controllers.
- Its request and response shapes follow the model conventions
  (`docs/conventions/model.md`) but live in the agent (`src/model/`), not
  in `packages/model`: they are the agent's contract with its console, not
  part of the Olympus API or the SDK.
- **OpenAPI**, as in the API:
  - generated from the code by the `openapi` script (and Turbo task) into
    `agent/openapi/<name>.json`, committed;
  - checked: the committed document must match the code, and it passes the
    API's Spectral ruleset;
  - served at `/api-spec` (Swagger UI) and `/api-spec-json` when the API
    explorer is enabled in configuration, like the API's
    `/<domain>/api-spec`.

### The console

- Follows the UX conventions (`docs/conventions/ux.md`, ADR 0012).
- Its API client is generated from the agent's committed OpenAPI document.

### Storage

An agent with a console may own a relational store (Minerva: Prisma on
SQLite or Postgres, ADR 0013). ADR 0007 applies to it: tables and
columns, no JSON documents in rows. The one accepted exception is an
outbox payload column, which holds the exact message body to publish and
is never queried.

## Consequences

- The Minerva question in ADR 0003 is answered: `agents/minerva-calendar-sync`.
- Adding a console to another agent means moving it to
  `agents/<name>/agent` and adding `console/`, with its management API on
  the API conventions from the start.
- The API's controller and OpenAPI checks have a second consumer. They are
  ported into Minerva's `test/conventions` first; moving them to a shared
  package is worth it when a third consumer appears.
- Renaming a management route is a contract change for the console only;
  provider callback paths never change without re-registering them.
