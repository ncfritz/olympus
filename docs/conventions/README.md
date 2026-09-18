# Conventions

These documents describe how code in this repository is written. They were
derived from the existing code (September 2026). Where the code is
inconsistent, the document names the preferred form for **new** code and
lists the existing deviations in [`../roadmap.md`](../roadmap.md).

| Area    | Document                 | Applies to                                   |
| ------- | ------------------------ | -------------------------------------------- |
| General | [general.md](general.md) | Everything                                   |
| Model   | [model.md](model.md)     | `packages/model`                             |
| API     | [api.md](api.md)         | `apps/api`                                   |
| Agent   | [agent.md](agent.md)     | `agents/*`                                   |
| UX      | [ux.md](ux.md)           | `apps/site`, `packages/ui`, `packages/theme` |

## How the conventions are enforced

| Mechanism                                                 | Covers                                  | Status                                         |
| --------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| Shared ESLint + Prettier (`packages/config`)              | Formatting, general lint                | Present                                        |
| `pnpm gen api-operation`                                  | New API operations start out conforming | Present                                        |
| Model decorator/type check (`check:conventions`)          | `packages/model`                        | Present                                        |
| Model schema and enum snapshots                           | `packages/model`                        | Present                                        |
| API controller check (`check:conventions`)                | `apps/api`                              | Present                                        |
| Spectral (`lint:openapi`)                                 | Generated OpenAPI documents             | Present                                        |
| Committed OpenAPI documents are current (`check:openapi`) | `apps/api/openapi`                      | Present                                        |
| Breaking-change detection                                 | OpenAPI documents                       | Deferred: review `openapi/*.json` diffs in PRs |
| Inline-style lint rule                                    | UX styling                              | Present as a warning (ADR 0012)                |

Each rule in these documents that is checked automatically is marked
**[checked]** once the check exists. A rule without the mark is enforced by
review.

## Changing a convention

Change the document, the generator templates and the checks in the same
commit. If the change is significant, add an ADR.
