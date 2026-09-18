# 0003. Repository layout

- **Status:** Accepted
- **Date:** 2026-09-18

## Decision

```
apps/        deployable HTTP / UI applications (api, site, desktop, minerva)
agents/      RabbitMQ-driven NestJS workers
packages/    libraries: config, model, sdk, ui, theme, shared
infra/       hasura/ (migrations + metadata), docker/ (bake + compose)
turbo/       generators/ (turbo gen templates)
docs/        architecture/, conventions/, decisions/, guides/, roadmap.md
```

Directory names drop the redundant prefix from the old repo names
(`olympus-api` → `apps/api`, `dionysus-search-agents` →
`agents/dionysus-search`). Package names do not change (ADR 0002).

Agents are separated from apps because they follow a different set of
conventions (`docs/conventions/agent.md`) and have no inbound HTTP surface
beyond health and metrics.

## Consequences

- The four convention areas (model, API, agent, UX) map to `packages/model`,
  `apps/api`, `agents/*`, and `apps/site` + `packages/ui` + `packages/theme`.
- Where Minerva calendar sync lands (one directory with nested apps, or
  split into `apps/minerva-sync-api` and `apps/minerva-sync-web`) is decided
  at import time.
