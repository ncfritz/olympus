# Architecture Decision Records

Each file records one decision: the context, what was decided, and what it
costs. Records are never edited to change a decision; a new record
supersedes the old one and the old one's status is updated to point at it.

Status values: **Proposed** (direction agreed, specifics still open),
**Accepted**, **Superseded by NNNN**, **Deprecated**.

| #                                                    | Decision                                                        | Status                      |
| ---------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| [0001](0001-monorepo-pnpm-turborepo.md)              | Monorepo with pnpm workspaces and Turborepo                     | Accepted                    |
| [0002](0002-internal-packages-from-workspace.md)     | Internal packages consumed from the workspace, not a registry   | Accepted                    |
| [0003](0003-repository-layout.md)                    | Repository layout                                               | Accepted                    |
| [0004](0004-toolchain-baseline.md)                   | Toolchain baseline                                              | Accepted                    |
| [0005](0005-stay-on-hasura-v2.md)                    | Stay on Hasura v2; do not adopt DDN                             | Accepted                    |
| [0006](0006-schema-under-version-control.md)         | Database schema and Hasura metadata under version control       | Accepted                    |
| [0007](0007-relational-schema-only.md)               | Tables and columns define the schema; no JSON documents in rows | Accepted                    |
| [0008](0008-preserve-and-enforce-api-conventions.md) | Preserve existing API conventions and check them automatically  | Accepted                    |
| [0009](0009-api-operation-generator.md)              | Stub generator for new API operations                           | Accepted                    |
| [0010](0010-testing-strategy.md)                     | Testing strategy                                                | Proposed                    |
| [0011](0011-centralized-docker-builds.md)            | Build all images centrally on the Mac Mini                      | Proposed                    |
| [0012](0012-theming-with-antd-tokens.md)             | Theming through AntD design tokens and a theme package          | Proposed                    |
| [0013](0013-minerva-calendar-sync-integration.md)    | Minerva calendar sync feeds Hasura over RabbitMQ                | Accepted (details deferred) |
| [0014](0014-feature-folder-layout.md)                | Feature-folder layout and service layer for the API             | Accepted                    |
| [0015](0015-agent-layout-and-shared-packages.md)     | Agent layout and shared service packages                        | Accepted                    |
| [0016](0016-agents-with-a-management-console.md)     | Agents with a management console                                | Accepted                    |

New records: copy [template.md](template.md), take the next number.
