# Roadmap and known issues

## Phases

| #   | Phase                                                                                                | Status                |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------- |
| 0   | Monorepo scaffolding, decisions, conventions                                                         | **done** (2026-09-18) |
| 1   | Import model and API; `openapi` task; convention checks; `api-operation` generator                   | **done**              |
| 2   | Import SDK and agents; retire publishing and `olympus-release`                                       |                       |
| 3   | Import site and desktop shell                                                                        |                       |
| 4   | Hasura baseline in `infra/hasura`; migrations workflow; cli-migrations image                         |                       |
| 5   | Referential integrity: orphan audit, foreign keys, derived relationships; metadata generation script |                       |
| 6   | Central Docker builds: bake file, local registry, per-host compose                                   |                       |
| 7   | Theme package; inline-style migration; `packages/ui`                                                 |                       |
| 8   | Minerva calendar sync import and Hasura integration                                                  |                       |
| —   | Tests are added in every phase (ADR 0010)                                                            | ongoing               |

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

## Model backlog

- Description typos in pre-existing descriptions (e.g. "TThe amount of
  progress", "unique identified"); each fix changes the schema snapshot.
- Deferred: base classes for the shared workflow lifecycle fields
  (content/media/metadata workflows and steps) and for movie/TV credits.
  They already extend other bases, so this needs `IntersectionType`;
  worth doing when those areas are next changed.
- Deferred until the SDK is imported: rename
  `LiatNotificationSettingsResponse` (changes an SDK export name).
- Consider documenting timestamps with `format: "date-time"`. This makes
  the Hey API SDK return `Date` objects instead of strings, a breaking
  change for the site and agents.

## Known issues found while writing the conventions

These are the starting allow-list for the convention checks. Fix them, or
record them as accepted deviations.

### API

The controller convention check (`apps/api/test/conventions`) and
Spectral (`pnpm lint:openapi`) track these; the allow-list holds the rest.

- **Deletes that answer `410 Gone`.** `DeleteContentAssetChannel`,
  `DeleteContentAssetTagFromAsset` and `DeleteMediaFavorite` respond 410
  instead of a 2xx (`DeleteMediaFavorite` also documents 201). With the
  SDK's `throwOnError`, callers see these as errors. Decision pending:
  switch to `204 No Content`.
- **`SendNotification` documents `207 Multi-Status`** for partial delivery
  but never sends it (only 202 or 400). Decision pending: implement or
  drop from the docs.
- **`UploadAssets`** doesn't follow the controller pattern (`uploadFile`
  returning the Multer file list, no `@Res()`); it documents 200 with an
  empty body but Nest answers 201 with the file list.
- **operationId typo** `ListNotificationsTypes` (class
  `ListNotificationTypesController`). Fix with the SDK import, since it
  renames an SDK function.
- Meeting operations use `SingleCalendarItemResponse { item }` /
  `ListCalendarItemsResponse { items }` instead of
  `<OperationId>Response` with entity-named properties.
- `ValidationPipe` is commented out; `class-validator` is unused.
- The API `Dockerfile` still targets the old single-repo layout (npm +
  GitHub Packages token). Rebuilt with ADR 0011.
- OpenAPI `info.version` is `0.0.0` (the workspace package version)
  instead of a release number.

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
