# Roadmap and known issues

## Phases

| #   | Phase                                                                                                | Status                                       |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0   | Monorepo scaffolding, decisions, conventions                                                         | **done** (2026-09-18)                        |
| 1   | Import model and API; `openapi` task; convention checks; `api-operation` generator                   | in progress: imports and `openapi` task done |
| 2   | Import SDK and agents; retire publishing and `olympus-release`                                       |                                              |
| 3   | Import site and desktop shell                                                                        |                                              |
| 4   | Hasura baseline in `infra/hasura`; migrations workflow; cli-migrations image                         |                                              |
| 5   | Referential integrity: orphan audit, foreign keys, derived relationships; metadata generation script |                                              |
| 6   | Central Docker builds: bake file, local registry, per-host compose                                   |                                              |
| 7   | Theme package; inline-style migration; `packages/ui`                                                 |                                              |
| 8   | Minerva calendar sync import and Hasura integration                                                  |                                              |
| —   | Tests are added in every phase (ADR 0010)                                                            | ongoing                                      |

## Open decisions

- Minerva directory layout in the monorepo (ADR 0003).
- Minerva → Hasura integration details (ADR 0013).
- Where CI runs (GitHub-hosted vs. self-hosted runner on the Mac Mini).
- Enabling `ValidationPipe` + `class-validator` in the API.
- Site data fetching approach (keep `useFetch`, adopt a query library, or
  server rendering), as part of the React best-practices pass.
- Styles mechanism for the theme migration (`antd-style` vs. CSS modules).
- Turning on full TypeScript `strict`.
- How AI agents interact with the platform (API-backed tools / MCP).

## Known issues found while writing the conventions

These are the starting allow-list for the convention checks. Fix them, or
record them as accepted deviations.

### API

- **Lint does not pass (pre-existing).** `eslint src` reports 32 errors
  (15 `no-explicit-any`, 13 `no-unused-vars`, 2 `no-useless-assignment`,
  2 Prettier), the same set the old repo reported. Most are in
  `NotificationsGateway.ts` and the batch-job controllers.
  `UpdateMediaAssetWorkflowStep.ts` also fails `pnpm format:check`.
- The API `Dockerfile` still targets the old single-repo layout (npm +
  GitHub Packages token). Rebuilt with ADR 0011.
- OpenAPI `info.version` is now `0.0.0` (the workspace package version)
  instead of the published release number.
- `ApiStandardErrorResponses({ exclude })`: the filter uses
  `key in options.exclude`, which tests array indices, not values, so
  `exclude` doesn't work as intended.
- `UpdateCalendarItem`: sends `304 Not Modified` for an empty change set
  but doesn't `return`, so execution continues. Its `summary`/`description`
  were copied from the notes operation ("Updates an existing note",
  "CUpdates an existing node").
- 38 operations declare `@ApiCreatedResponse` but only one sends
  `201 Created`. The documented and actual status codes disagree.
- `GetNotesSummary.ts` exports `GetMonthlySummaryController` (file, class
  and operation names should agree).
- Meeting operations use `SingleCalendarItemResponse { item }` /
  `ListCalendarItemsResponse { items }` instead of
  `<OperationId>Response` with entity-named properties.
- `ValidationPipe` is commented out; `class-validator` is unused.
- The API's OpenAPI specs are produced by a Jest test in `postbuild`.

### Agents

- Agents depend on `"@ncfritz/olympus-sdk": "latest"`.
- `RabbitModule` logs the full AMQP URI, including the password.
- No explicit nack / dead-letter strategy for failed messages.
- `dionysus-asset-agents` handler files are camelCase
  (`rawIngestionHandler.ts`); other agents use PascalCase.
- `console.log` in handlers (e.g. `BaseSearchHandler`).
- `dionysus-asset-agents` lists `@golevelup/nestjs-graphql-request` as a
  dependency; agents shouldn't talk to Hasura. Check whether it's used.

### Site

- A Google Maps API key is hard-coded in `src/pages/_app.tsx`. Move it to
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, and restrict the key by referrer in
  the Google console.
- `eslint.ignoreDuringBuilds: true` and `reactStrictMode: false` in
  `next.config.mjs`.
- About 1,700 inline style objects in about 225 files.
- Site Docker image uses Node 22; everything else uses Node 26.

### Toolchain drift (resolved by the import)

- TypeScript 5.4 / 5.9 / 6.0; ESLint 8 / 9 / 10; Node 22 / 26.
