# Working in this repository

Olympus monorepo: pnpm workspaces + Turborepo. Read these before changing
code:

- `docs/conventions/general.md`: always
- `docs/conventions/model.md`: `packages/model`
- `docs/conventions/api.md`: `apps/api`
- `docs/conventions/agent.md`: `agents/*`
- `docs/conventions/ux.md`: `apps/site`, `packages/ui`, `packages/theme`
- `docs/decisions/`: why things are the way they are. Don't contradict an
  Accepted ADR without proposing a new one.

## Rules

- Follow the existing conventions exactly. The goal is consistency with the
  code that's already here, not a better pattern.
- New API operations: start from `pnpm gen api-operation` once it exists,
  otherwise copy the shape in `docs/conventions/api.md`.
- The API is the only Hasura client. Agents and the site use the SDK.
- Schema changes are migrations in `infra/hasura/migrations`. No JSON
  documents in rows (ADR 0007).
- Internal deps use `workspace:*`; shared third-party versions use
  `catalog:`. Never `latest`.
- No secrets in source or logs. Env files are not committed; update the
  `*.env.example`.
- When a convention changes, update the doc, the generator templates and
  the checks in the same change.
- Run `pnpm turbo run build lint test check:conventions --filter=<pkg>...`
  before calling work done.
