# 0005. Stay on Hasura v2; do not adopt DDN

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Postgres and Hasura v2 run locally in Docker. Requirements: everything runs
locally with no dependence on cloud services, performance comparable to v2,
and no change to where logic lives or how the API talks to Hasura.

How the API uses Hasura today:

- `olympus-api` is the **only** Hasura client. Agents and the site go
  through the SDK.
- A single `GraphQLClient` (`graphql-request`) authenticates with the admin
  secret.
- About 216 request sites, written as inline `gql` documents with
  hand-written response types. Most use `*_by_pk`, `insert_*` with
  `on_conflict` upserts, `update_*` and `*_aggregate`.
- No subscriptions and no calls to the metadata or `run_sql` APIs.

Hasura DDN (v3) was evaluated (September 2026):

- The v3 engine and data connectors are Apache-licensed and can run in
  Docker. The DDN CLI, console and metadata build are proprietary, and
  users report that metadata cannot be built without Hasura's cloud.
- Self-hosting DDN in production requires an enterprise license and
  Kubernetes.
- DDN generates a different GraphQL API (names and shapes of mutations and
  aggregates), so every request site would be rewritten.

Hasura's v2 support policy: v2.45 is an LTS release supported to
2027-01-01, and the final v2 LTS will get a three-year end of life.

## Decision

Stay on Hasura v2. Pin to an LTS release. Keep the API as the only client
and keep the existing access pattern (ADR 0008). Revisit only if v2's final
LTS end-of-life comes into view or a local-only DDN path appears.

## Consequences

- No migration cost. The debt work (ADR 0006, 0007) happens within v2.
- All Hasura access stays behind the API, so replacing Hasura module by
  module later remains possible without touching the SDK or its consumers.

## References

- https://hasura.io/legal/support-policy-hasura-v2
- https://hasura.io/docs/3.0/private-ddn/architecture/self-hosted/
- https://github.com/hasura/graphql-engine/discussions/10556
