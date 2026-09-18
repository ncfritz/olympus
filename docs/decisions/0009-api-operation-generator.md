# 0009. Stub generator for new API operations

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

API work continues partly by hand. Each new operation touches several files
in a fixed pattern: the controller, request/response classes in the model,
a converter, and registration in an `*ApiModule`.

## Decision

Provide a Turborepo generator, `pnpm gen api-operation`, in
`turbo/generators/`. It prompts for the details and writes files that
already pass the convention checks (ADR 0008). The design is in
`docs/guides/api-operation-generator.md`. It is built immediately after
`apps/api` and `packages/model` are imported so it can be tested against the
real code.

## Consequences

- The templates are a second, executable copy of the conventions. When a
  convention changes, the docs, templates and checks change in the same
  commit.
