# Convention checks (design)

Status: planned (ADR 0008). Implemented after the API import.

`pnpm check:conventions` runs a `check:conventions` script in each package
that defines one.

| Package                    | Check                                                | Tool                                          |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `apps/api`                 | Controller architecture test                         | Vitest + Nest `DiscoveryService` / reflection |
| `apps/api`                 | OpenAPI lint                                         | Spectral, ruleset `apps/api/.spectral.yaml`   |
| `apps/api`                 | Breaking-change diff                                 | oasdiff against `apps/api/openapi/*.json`     |
| `packages/model`           | `@ApiProperty` completeness, request/response naming | Vitest, reads swagger metadata                |
| `apps/site`, `packages/ui` | Inline style ratchet                                 | ESLint count vs. `.style-baseline`            |

## Handling existing deviations

Each check reads an allow-list (`conventions.allow.json` in the package)
of known deviations with a reason. The list starts with what
`docs/roadmap.md` records and only shrinks: an entry that no longer fails
is reported so it can be removed.
