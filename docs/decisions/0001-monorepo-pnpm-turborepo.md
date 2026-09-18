# 0001. Monorepo with pnpm workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Olympus is split across one repository per component (model, API, SDK,
site, desktop shell, four agents). Model, API and SDK are built by GitHub
Actions and published to a personal GitHub npm registry. A change to the API
surface requires publishing the model, then the API, regenerating and
publishing the SDK, then bumping the SDK in every consumer. Adding shared
packages (UI components, theme, shared logic) would multiply this.

The existing repos have also drifted: TypeScript 5.9 and 6.0, ESLint 8, 9
and 10, Node 22 and 26 base images.

## Decision

Combine the repositories into a single monorepo using **pnpm workspaces**
for dependency management and **Turborepo** for task orchestration and
caching. Nx was considered; it has stronger NestJS generators but a larger
configuration surface than a single-maintainer project needs.

Repositories are imported **with history** (`git filter-repo
--to-subdirectory-filter <dir>` then merge), one at a time, per
`docs/guides/repo-import.md`. The minerva-calendar-sync monorepo (already
pnpm + Turbo) is imported the same way.

## Consequences

- A change to the model or API is visible to the SDK, site and agents in the
  same commit; breaking changes fail type-checking immediately.
- The build graph (`api → openapi → sdk → consumers`) is explicit in
  `turbo.json` and cached.
- One lockfile and one set of tool versions.
- The per-repo semantic-release and GitHub Actions publishing pipelines are
  retired as each repo is imported.
- The original repositories become read-only archives after import.
