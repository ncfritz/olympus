# 0008. Preserve existing API conventions and check them automatically

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The API's patterns are already highly consistent. Of 197 controllers, all
use `version: "1"`, `operationId`, `tags`, `@ApiStandardErrorResponses()`
and `@Res()`, 196 expose a single `async handle()`, and 191 contain an
inline `gql` document. The goal is not to replace this. The goal is that new
operations follow the same conventions, whether written by hand or with AI
help.

## Decision

1. **Document** the conventions in `docs/conventions/` (general, model, API,
   agent, UX), derived from the existing code.
2. **Check them automatically** in a `check:conventions` task that CI and
   `pnpm check:conventions` run:
   - **Architecture test** (Vitest): boots the Nest application and walks
     every controller's metadata to check one route per class, class name =
     `operationId` + `Controller`, unique `operationId`, tags present,
     standard error responses attached, version `1`, and registration in an
     `*ApiModule` that belongs to an OpenAPI document.
   - **Spectral ruleset** on the generated OpenAPI documents: PascalCase
     `operationId`, `summary` and `description` present, every operation
     tagged, standard error responses documented, `components.schemas` names
     PascalCase.
   - **Spec diff** (`oasdiff`) against the committed spec. Breaking changes
     fail unless acknowledged.
   - **Model check**: every exported class property in `packages/model`
     carries `@ApiProperty` with `description` and explicit `required`.
3. **Improve without replacing.** Additions that keep the pattern (typed
   GraphQL documents via codegen, shared query fragments) are allowed but
   not required for existing code.

## Consequences

- A repo with no tests gets a suite covering every endpoint at once.
- Known deviations found while writing the conventions are listed in
  `docs/roadmap.md` and fixed or explicitly allow-listed. They do not block
  the checks from being introduced.
