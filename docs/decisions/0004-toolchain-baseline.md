# 0004. Toolchain baseline

- **Status:** Accepted
- **Date:** 2026-09-18

## Decision

| Tool        | Version                                      | Notes                                                                                                       |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Node        | 26 (`.nvmrc`)                                | Matches the API and agent base images. The site moves from Node 22 on import.                               |
| pnpm        | 10.x (`packageManager`)                      | Current stable line with catalogs. Newer majors can be adopted later deliberately.                          |
| TypeScript  | 6.0                                          | TypeScript 7 (native compiler) is not adopted until NestJS decorator metadata is confirmed to work with it. |
| ESLint      | 10, flat config                              | Shared config in `packages/config/eslint`.                                                                  |
| Prettier    | 3, default options plus `trailingComma: all` | Matches existing formatting.                                                                                |
| Test runner | Vitest                                       | See ADR 0010.                                                                                               |

Compiler options in `packages/config/tsconfig/base.json` match the existing
repos (`strict: false` with `strictNullChecks`, `noImplicitAny`,
`noImplicitReturns`, `noUnusedLocals`) so imported code compiles without
changes. Turning on full `strict` is a later, per-package step.

Node 26 no longer ships Corepack, so pnpm is installed directly
(`npm i -g pnpm@10`, or Homebrew).

## Consequences

- Imported packages drop their own ESLint, Prettier, Husky and TypeScript
  devDependencies in favour of the shared ones.
- Version drift is handled in one place (catalog + shared config).
