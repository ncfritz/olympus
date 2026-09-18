# 0010. Testing strategy

- **Status:** Proposed
- **Date:** 2026-09-18

## Context

There are no unit tests. The API has one Jest "test" whose job is to write
the OpenAPI specs during `postbuild`.

## Decision

- **Runner:** Vitest everywhere. Nest packages use the `vitest/nest` preset
  (SWC transform, so decorator metadata is emitted).
- **Spec generation becomes a real task.** `apps/api` gets an `openapi`
  script that writes `openapi/*.json`. It stops being a Jest test.
- **Layers, in order of value:**
  1. Convention checks (ADR 0008) and an OpenAPI contract snapshot.
  2. Characterization tests around code about to be refactored.
  3. API integration tests against disposable Postgres + Hasura
     (Testcontainers + the cli-migrations image from `infra/hasura`).
  4. Agent handler tests with the SDK mocked.
  5. Site: React Testing Library with MSW mocking the SDK; a few Playwright
     smoke tests on critical flows.
- **Coverage ratchet:** coverage may not decrease in CI. No up-front
  coverage targets.

## Open

- Exact Testcontainers setup (the Mac Mini runs Docker; CI location TBD).

## Update (2026-09-18)

Before Testcontainers is set up (layer 3), API endpoint tests run the real
`AppModule` against an in-memory Hasura double keyed by GraphQL operation
name, with RabbitMQ stubbed. See
[the API testing guide](../guides/api-testing.md). Testcontainers tests
remain the target for checking the GraphQL documents against the real
schema, which the double cannot do.
