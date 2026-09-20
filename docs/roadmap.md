# Roadmap and known issues

## Phases

| #   | Phase                                                                                                | Status                           |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0   | Monorepo scaffolding, decisions, conventions                                                         | **done** (2026-09-18)            |
| 1   | Import model and API; `openapi` task; convention checks; `api-operation` generator                   | **done**                         |
| 2   | Import SDK and agents; retire publishing and `olympus-release`                                       | SDK and all four agents **done** |
| 3   | Import site and desktop shell                                                                        |                                  |
| 4   | Hasura baseline in `infra/hasura`; migrations workflow; cli-migrations image                         |                                  |
| 5   | Referential integrity: orphan audit, foreign keys, derived relationships; metadata generation script |                                  |
| 6   | Central Docker builds: bake file, local registry, per-host compose                                   |                                  |
| 7   | Theme package; inline-style migration; `packages/ui`                                                 |                                  |
| 8   | Minerva calendar sync import and Hasura integration                                                  |                                  |
| —   | Tests are added in every phase (ADR 0010)                                                            | ongoing                          |
| —   | Dionysus endpoint tests, one area per commit ([plan](guides/api-testing.md#dionysus-plan))           | **done**                         |
| —   | Dionysus metadata converter tests; null-safe object relationships                                    | **done**                         |
| —   | API aligned with NestJS (ADR 0014): feature folders; services per entity; guards, config, logger     | **done**                         |

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

## Backlog

Planned work outside the phases, in no particular order.

1. **Chore: decorate all APIs to capture Prometheus metrics.** Today the
   API's `PrometheusMetricsInterceptor` records per-operation counts and
   latency keyed by operationId; agents expose only the default Node
   metrics.
2. **Chore: add application-level Prometheus metrics**, beyond HTTP and
   runtime metrics.
3. **Feature: deliver a Grafana dashboard, source-controlled** (alongside
   the rest of `infra/`).
4. **Feature (notification agent): interactive message tester,
   web-based.**
5. **Feature (notification agent): delivery audit trail and metrics.**

## Model backlog

- Phase 4 (first migrations): replace the metadata fetch job `context`
  (base64 JSON in a text column, `FetchJobContext` in the model) with
  columns. Only the episode fetch reads it, for its season's id, so a
  `seasonId` column on fetch jobs covers it; the season count that
  season fetch jobs carry is never read. Then drop `context` from the
  column, the model and the API, and update the metadata agent.

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

- Decided (2026-09-18): the content channel, content tag and media
  favorite deletes keep answering `410 Gone`; the convention allows it for
  `DELETE` only.
- **operationId typo** `ListNotificationsTypes` (class
  `ListNotificationTypesController`). Fix with the SDK import, since it
  renames an SDK function.
- Meeting operations use `SingleCalendarItemResponse { item }` /
  `ListCalendarItemsResponse { items }` instead of
  `<OperationId>Response` with entity-named properties.
- `ValidationPipe` is commented out; `class-validator` is unused.
- Route shapes kept for SDK compatibility, to revisit with the SDK import:
  `GetMediaAssetSearchConfigurationsRunningCount` is a `PUT` but only
  reads; `CreateMediaAssetWorkflow` is
  `POST .../workflow/:resultId/workflow`.
- Black curtain (decided 2026-09-18): enforced server-side for every
  request without a valid content auth cookie; `x-dionysus-content-bc` is
  ignored. Still open: the size/duration/width/height statistics come from
  database views that can't be curtained without a view change (phase 4),
  and channel mutations return the full channel even when it is not
  curtain compliant.
- `DescribeNetwork` moved from `/v1/dionysus/dionysus/network/:networkId`
  to `/v1/dionysus/metadata/network/:networkId` (2026-09-18). The site
  calls the old path until the SDK is regenerated (phase 2).
- Without referential integrity (phase 5), related rows can be missing.
  Metadata converters leave a missing single relationship undefined (the
  model marks those properties optional) and skip list entries whose row
  is missing. Clients must handle `originalLanguage`, a season's `series`,
  an episode's `series`/`season`, and the country/language of titles,
  videos and release dates being absent.
- The API `Dockerfile` still targets the old single-repo layout (npm +
  GitHub Packages token). Rebuilt with ADR 0011.
- OpenAPI `info.version` is `0.0.0` (the workspace package version)
  instead of a release number.
- Found while extracting services (2026-09-19; behaviour kept as is):
  - Many not-found errors are a bare `NotFoundException()`, or use other
    wording, not `<Entity> with id <id> not found`.
  - `204`/`304` responses sent with a body (DeleteBatchJob,
    DeleteMetadataFetchJob, AcknowledgeNotification, AddContentAssetTagToAsset).
  - Updates that mutate the incoming request object (UpdateBatchJob,
    UpdateMediaAssetDownloadByNzbId, UpdateMediaAssetWorkflowStep,
    UpdateContentIngestionWorkflow, CreateTVSeries/Season cast and crew).
  - Data bugs: CreateTVSeriesEpisode never sends `$runtime`;
    CreateNotification ignores `eventTime`; Describe/UpdateBatchJob don't
    select `maxRecordsToProcess`; UpdateMediaAssetSearchExecution ignores
    `mediaType`/`mediaId`; the NZB-ID progress guard skips progress 0;
    CreateMediaAssetDownload publishes `nzbId: resultId`;
    UpdateContentIngestionWorkflowStep never checks for a missing row;
    ListCalendarItems misses meetings overlapping one end of the range;
    GetNextCalendarItemOccurrence answers 200 with no item; genre
    histograms drop titles with more than 19 genres.
  - Response/document mismatches: CreateMovie sends `{ id }` but documents
    `{ movie }`; GetContentAssetAggregateStatistics sends an untyped body
    (the model's `ContentAggregateStatisticsResponse` fits);
    DeleteMediaAssetWorkflow documents 204 but a soft delete answers 200;
    person cast/crew lists document pagination they ignore.
  - Content auth: CheckAuthorization verifies the token differently (own
    query, no audience check, 30-minute max age vs. a 15-minute cookie) and
    500s with a TypeError when the key row is missing.
  - Two `filters` formats (base64 `FilterDefinition` vs. `parseInFilters`).
  - OpenAPI text: copy-paste descriptions and typos (ping, people
    statistics, "cunt", "movie1", "production company1", "CreateCLanguage",
    "refine the refine the"), and wrong tags (ListPeople "Batch", media
    workflow steps "Content", DeleteMediaAssetWorkflow "Batch").
  - Metadata modules import `RabbitModule` without using it.

### Agents

- Agents depend on `"@ncfritz/olympus-sdk": "latest"` (not-yet-imported
  agents; imported ones use `workspace:*`).
- Notification agent (imported 2026-09-19):
  - **Rotate credentials**: two Synology Chat webhook tokens and the
    Gmail app password were hard-coded in source, and the Synology SMTP
    password is in older history. They are redacted from the imported
    history and now come from the environment, but they remain in the
    olympus-notification-agent repository.
  - On the agent conventions (ADR 0015), with tests. Fixed on the way:
    Synology Chat bot messages going to the channel (message contract),
    the webhook body, a Socket.IO connection per notification, durable
    notifications posted to a dead route, system_test emails failing,
    partials reloaded per email, attachment selection, template typos.
  - SMTP transports set `tls.rejectUnauthorized: false`.
  - Failed deliveries are logged and acknowledged; nothing retries.
- Asset agent (imported 2026-09-19):
  - **Rotate credentials**: the SFTP password of the `content` account on
    nfs01 was hard-coded in one commit (later removed). It is redacted
    from the imported history but remains in the
    dionysus-asset-agents repository.
  - On the agent conventions (ADR 0015), with tests; contracts from
    `@ncfritz/olympus-messages`. Feature modules for content, media and
    downloads; HandBrake and FFmpeg behind an injectable `ToolsModule`;
    the transcode's state is per message (it was kept in handler fields,
    shared by overlapping transcodes); track selection, the HandBrake
    job, verification samples and library paths are pure planners.
    Fixed on the way: the AMQP password in the logs, the SFTP password in
    source, `console.log` throughout, bootstrap failures writing to
    `/logs`, an unused Hasura client dependency.
  - In `DEPLOYMENT_MODE=local`, `MediaWorkflow.downloadFile` returns the
    file's text where the handlers expect parsed JSON (the CDN path
    parses it), so local transcodes can't read their job.
- Metadata agent (imported 2026-09-19):
  - On the agent conventions (ADR 0015), with tests; contracts from
    `@ncfritz/olympus-messages`, `ExecuteWithMetrics` from
    `@ncfritz/olympus-nest`. Each batch run gets its own record source
    (the handlers kept one job's state in instance fields), the TMDB →
    API mapping is in pure mappers, and the SQLite cache is one
    connection per process (it was opened per message). Fixed on the way:
    the AMQP password in the logs, bootstrap failures writing to `/logs`.
  - Fixed after the restructure, one commit each: metric names with dots
    (Prometheus rejects them: no client metrics, an error per call);
    production company alternative names fetched from the network
    endpoint; series → season and season → episode freshness judged by
    the parent's TTL; graceful shutdown never running (async work in a
    synchronous exit hook, now Nest shutdown hooks); jobs that aren't new
    registered as running; `max` processing one record too many; no
    notification for a workflow failing after its last retry; an unset
    `DIONYSUS_CACHE_PATH` failing every job (now `./cache`).
  - Also fixed: movie TTLs that were always the same value
    (`Math.max(n, random × m)` with m < n), and TMDB dates parsed in the
    host's time zone.
  - The fetch job `context` is base64 JSON in a column: see the model
    backlog (phase 4).
- Search agent (imported 2026-09-19):
  - On the agent conventions (ADR 0015), with tests; the RabbitMQ
    contracts come from `@ncfritz/olympus-messages`. Fixed on the way:
    the AMQP password in the logs, `console.log` of failed searches,
    bootstrap failures writing to `/logs`.
  - Fixed after the restructure, one commit each: the NZBGeek API key
    reaching logs in Axios errors; `finishedTime` records the start
    time; season searches send `episode` instead of `episodeNumber` in
    `initiatingAsset`; an episode search with no results is marked
    failed (a movie's is skipped); every release parsed after a
    REPACK/PROPER marked a repack (shared `DEFAULT_REVISION`); 2160p
    remuxes parsed as Remux-1080p; custom formats matching on any one
    title or group condition (every DV release was "Generated Dynamic
    HDR", −10000; resolution/source-only formats never matched);
    release groups not parsed, so the group tier formats never matched.
  - TV series searches update the series' search configuration once per
    season, inside the loop (and not at all without seasons).
  - Nothing in the monorepo or the imported repositories publishes
    `search.fanout.trigger`; whatever schedules the fanout lives
    elsewhere and isn't source-controlled.
- No explicit nack / dead-letter strategy for failed messages.

### Messages

Found while writing `@ncfritz/olympus-messages` from the publishers;
check the consumers when the metadata and asset agents are imported.

- Transcode messages never carry `mediaExtension`.
- Downloads started on their own (CreateMediaAssetDownload) have no
  `workflowId`; the asset agent tracks them but leaves the files in
  NZBGet's destination directory (nothing stages or transcodes them).
- `bypassCache` is optional on batch and metadata job messages (the
  metadata agent treats absent as false).
- The API accepts batch jobs for `tv_seasons` and `tv_episodes`, which no
  agent consumes (by design: series and season fetches queue them), so
  such a job stays `created`.
- The NZBGet scripts publish every event with routing key `update.queue`;
  scan events have no `nzbId` to match a download by.
- Non-TypeScript publishers (the NZBGet scripts) are checked against
  generated JSON Schemas; add a schema to `pnpm schemas` for any other.

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
