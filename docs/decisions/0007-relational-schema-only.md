# 0007. Tables and columns define the schema; no JSON documents in rows

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Olympus is moving toward an AI-centric interaction model, and the goal is to
avoid hand-defining tables and mappings for every new concept. One option
was a generic document table (JSONB payload + JSON Schema registry). That
option was rejected.

## Decision

- The database schema is expressed as tables and columns with foreign keys
  and constraints. No nested JSON structures inside rows as a way to avoid
  schema changes.
- The cost of adding a table is reduced by automation instead:
  migration (hand-written or AI-drafted and reviewed) → generated Hasura
  tracking and relationships (ADR 0006) → generated API operation stubs
  (ADR 0009).
- AI agents interact with data through the API, not directly with tables.

## Consequences

- Every new concept is a schema change, reviewed like code.
- Existing JSON columns, if any, are left as they are. This decision covers
  new design.
