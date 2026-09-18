# Architecture overview

```
               ┌──────────────┐        ┌──────────────┐
  browser ───▶ │  apps/site   │        │ apps/desktop │ (Electron shell)
               │ Next.js+AntD │        └──────┬───────┘
               └──────┬───────┘               │
                      │ SDK (HTTP /v1)        │
                      ▼                       ▼
               ┌──────────────────────────────────────┐
               │              apps/api                │  NestJS
               │  controllers → gql → Hasura          │  OpenAPI docs: Olympus, Dionysus, Minerva
               │  AmqpConnection → RabbitMQ           │
               │  Socket.IO gateway (notifications)   │
               └──────┬───────────────────┬───────────┘
                      │ GraphQL (admin)   │ AMQP
                      ▼                   ▼
               ┌─────────────┐     ┌─────────────┐
               │ Hasura v2   │     │  RabbitMQ   │◀───────────────┐
               │ + Postgres  │     └──────┬──────┘                │
               └─────────────┘            │                       │
                      ▲                   ▼                       │
                      │ (future:   ┌───────────────────┐   ┌──────┴────────────────┐
                      │  Minerva   │ agents/*          │   │ minerva-calendar-sync │
                      │  consumer) │ asset, metadata,  │   │ own store (Prisma)    │
                      └────────────│ search, notify    │   │ outbox → calendar.events
                                   │ → API via SDK     │   └───────────────────────┘
                                   └───────────────────┘
```

## Build graph

```
packages/config ─┐
packages/model ──┼─▶ apps/api ──(openapi)──▶ packages/sdk ──▶ apps/site
                 │                                        └─▶ agents/*
packages/theme ──┴─▶ packages/ui ───────────────────────────▶ apps/site
```

The API's `openapi` task writes `apps/api/openapi/{olympus,dionysus,minerva}.json`.
The SDK's `generate` task runs Hey API on those files. Turbo caches both,
so the SDK regenerates only when the API surface changes.

## Deployment

- Mac Mini (M2, arm64): API, site, agents, Hasura, Postgres, RabbitMQ.
- Synology NAS (Intel, amd64): one image; static asset servers.
- Images are built centrally on the Mac Mini (ADR 0011).

## Domains

| Domain   | Scope                                                   | OpenAPI document |
| -------- | ------------------------------------------------------- | ---------------- |
| Olympus  | Platform: admin, notifications                          | `/olympus`       |
| Dionysus | Media: content, metadata, media assets, workflows, jobs | `/dionysus`      |
| Minerva  | Personal productivity: notes, meetings / calendar       | `/minerva`       |
