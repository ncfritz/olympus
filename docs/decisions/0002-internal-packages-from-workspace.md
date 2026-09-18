# 0002. Internal packages consumed from the workspace, not a registry

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Nothing outside Olympus consumes `olympus-model`, `olympus-api` or
`olympus-sdk`. Publishing them exists only to move code between repos.
Agents currently depend on `"@ncfritz/olympus-sdk": "latest"`, so builds
are not reproducible.

## Decision

- Workspace packages depend on each other with `"workspace:*"`. Nothing is
  published.
- Third-party versions shared by more than one package are declared once in
  the `catalog:` section of `pnpm-workspace.yaml` and referenced as
  `"catalog:"`.
- Package names keep the existing `@ncfritz/olympus-*` scope so imports in
  existing code do not change. New packages follow the same pattern
  (`@ncfritz/olympus-ui`, `@ncfritz/olympus-theme`, ...).
- Internal packages keep `"version": "0.0.0"` and `"private": true`.

## Consequences

- No version bumps or release pipeline for internal packages.
- If a package is ever needed outside the monorepo, add Changesets for that
  package only.
