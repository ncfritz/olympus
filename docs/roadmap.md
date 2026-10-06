# Roadmap and known issues

## Phases

| #   | Phase                                                                                                | Status                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0   | Monorepo scaffolding, decisions, conventions                                                         | **done** (2026-09-18)                                                                    |
| 1   | Import model and API; `openapi` task; convention checks; `api-operation` generator                   | **done**                                                                                 |
| 2   | Import SDK and agents; retire publishing and `olympus-release`                                       | SDK and all four agents **done**                                                         |
| 3   | Import site and desktop shell (the site first changes only for authentication, phase 9)              |                                                                                          |
| 4   | Hasura baseline in `infra/hasura`; migrations workflow; cli-migrations image                         | baseline and workflow **done** (2026-09-20); cli-migrations image in the deployment work |
| 5   | Referential integrity: orphan audit, foreign keys, derived relationships; metadata generation script |                                                                                          |
| 6   | Central Docker builds and compose stacks (ADR 0011, 0019, [plan](plans/docker/README.md))            | planned; before authentication phase 3                                                   |
| 7   | Theme package; inline-style migration; `packages/ui`                                                 |                                                                                          |
| 8a  | Minerva calendar sync import (ADR 0016)                                                              | **done** (2026-09-20)                                                                    |
| 8b  | Minerva → Hasura integration (ADR 0013)                                                              |                                                                                          |
| 9   | Authentication (ADR 0018, [plan](plans/authentication/README.md))                                    | phases 0 and 1 **done** (2026-09-20); phases 2-8 planned                                 |
| 10  | Internal CA: PKI service and signer (ADR 0020, [plan](plans/internal-ca/README.md))                  | proposed                                                                                 |
| 11  | Olympus Control: the console suite (ADR 0021, [plan](plans/console/README.md))                       | planned; after the Docker work                                                           |
| 12  | Weather: forecasts, radar, stations (ADR 0024, [plan](plans/weather/README.md))                      | proposed                                                                                 |
| 13  | Minerva goals: categories, goals, check-ins, habits (ADR 0026, [plan](plans/goals/README.md))        | phases 0–4 **done** (2026-10-01); phase 5 built, not signed off; phases 6–9 planned      |
| 14  | Email management: label audit and suggestions (ADR 0030, [plan](plans/email-management/README.md))   | phases 0 and 1a **done** (2026-10-05, M0 signed off); 1b, 2 and 3 next                   |
| —   | Tests are added in every phase (ADR 0010)                                                            | ongoing                                                                                  |
| —   | Dionysus endpoint tests, one area per commit ([plan](guides/api-testing.md#dionysus-plan))           | **done**                                                                                 |
| —   | Dionysus metadata converter tests; null-safe object relationships                                    | **done**                                                                                 |
| —   | API aligned with NestJS (ADR 0014): feature folders; services per entity; guards, config, logger     | **done**                                                                                 |
| —   | Shared API client and request metrics (ADR 0017)                                                     | **done** (2026-09-20)                                                                    |

## Open decisions

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

1. **Monitoring strategy** (next conversation): dashboards and alerts on
   the ADR 0017 request metrics (API view by client, client view against
   the API).
2. **Chore: add application-level Prometheus metrics** to the Dionysus
   and notification agents (work done, failures, queue lag), as Minerva
   has (`sync_runs_total`, `outbox_publishes_total`, ...).
3. **Feature: deliver a Grafana dashboard, source-controlled** (alongside
   the rest of `infra/`).
4. **Feature (notification agent): interactive message tester,
   web-based.**
5. **Feature (notification agent): delivery audit trail and metrics.**
6. **Feature (site): Google Maps map ID, for light and dark themes.** The
   weather map is styled in code (`STYLE_SHIFT_WORKER`, greyscale) and
   marks the location with a deck.gl dot, because Google's classic
   `Marker` is deprecated and its replacement, `AdvancedMarker`, only works
   on a map with a map ID, which in turn replaces code styling with styles
   kept in the Google Cloud console. Moving to map IDs (one per theme) goes
   with the site's light and dark themes (ADR 0012); at that point the dot
   becomes an `AdvancedMarker`.

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
- Retries and back-offs (`x-delay`) use RabbitMQ's delayed-message
  exchange plugin, which is no longer maintained and can't run on
  RabbitMQ 4.3 (Mnesia is removed). The broker stays on 4.1 until the
  delays move to per-delay queues with a TTL that dead-letter back
  (ADR 0019).
- Every `Dockerfile` still targets the old single-repo layout (npm +
  GitHub Packages token) and copies `production.env` into the image.
  Rebuilt in phase 6 (ADR 0011, 0019).
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
  - Fixed after the restructure, one commit each: the test handler
    overwriting a movie's CDN metadata (removed, with its route); a
    failed HandBrake run carrying on to upload; movies without a release
    date filed without `.mp4`; SFTP connections left open by failed
    uploads; SHA-256 steps hanging on read errors; the NZBGeek API key in
    failure logs; NZB fetch or parse failures escaping the handler (and
    requeueing forever); NZB files left in `/tmp`; downloads without a
    workflow staged as workflow `undefined`; NaN progress for downloads
    under 1 MB; a "multiple media files" warning on every download;
    burned-in subtitle choice depending on track order; startup failing
    without a SOCKS proxy; the cleanup request published non-persistent;
    every media asset recorded at `/Dionysus/media/transcoded.mp4`
    instead of its library path.
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
- Minerva calendar sync (imported 2026-09-20, ADR 0016):
  - Management API on the API conventions: one operation per controller
    under `/v1`, models in `src/model`, the OpenAPI document generated,
    checked, linted and served at `/api-spec`; the console's client is
    generated from it. Provider callbacks (OAuth login and callback,
    Google and Microsoft webhooks) are unversioned and outside the
    document. Convention checks in `agent/test/conventions`; the
    `calendar.events` contract in `@ncfritz/olympus-messages`, with a JSON
    Schema; Prometheus metrics at `/metrics`. Environment variables
    renamed (`LISTEN_PORT`, `OUTBOX_ENABLED` + `AMQP_*`, `OUTBOX_*`).
  - Fixed on the way: calendar-color e2e tests depending on test order.
    Fixed after, one commit each: syncs cut off by the database
    disconnecting at shutdown.
  - Decided (2026-09-20): `recurrenceRule` may hold Microsoft's Graph
    recurrence pattern as JSON text; it is reference-only (ADR 0016,
    Storage).
  - Deleting an override block answers `204` whether or not it existed
    (idempotent; kept).
  - The outbox dispatcher's tick in progress at shutdown is not awaited.
    Delivery is at least once, so a publish cut off is retried.
- No explicit nack / dead-letter strategy for failed messages.

### Not-found handling

Callers disagree on what a `404` from an API means. Settle it during the
site import, which has more instances. Until then `@ncfritz/olympus-client`
throws by default and returns `undefined` only where a method declares
`T | undefined` (`describeBatchJob`, `describeMetadataFetchJob`, the search
configuration and result describes, `updateMediaAssetDownloadByNzbId`).

- `ExecuteWithMetrics` (`@ncfritz/olympus-nest`) still turns any `404` into
  `undefined`, whatever the method's declared type; the metadata agent's
  TMDB calls rely on it.
- Moving the metadata agent onto the client (2026-09-20) changed its
  creates and updates: a `404` used to become `undefined` (every wrapper
  was under `ExecuteWithMetrics`) and now throws.
- Fixed with ADR 0017: `ExecuteWithMetrics` recorded failed calls with
  status `0`, so error counts were always zero.

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

### API

- **`GetContentAssetAggregateStatistics` is declared with the wrong response
  type.** The controller's `@ApiOkResponse` says `ContentStatisticsResponse` --
  the categories-and-series shape the four distribution endpoints return -- while
  the service returns `ContentAssetAggregateStatistics`, nine numbers (count, and
  min/max/avg/total for size and duration). So the OpenAPI document is wrong, the
  generated SDK inherited it, and `apps/site`'s statistics panel has to cast
  across the gap (`ContentAssetStatistics.tsx`, with the reason at the cast).

  Found by typing that panel, 2026-09-29: the `any` on its state had been hiding
  the disagreement. The fix is the decorator, a regenerated SDK, and removing
  that cast and its local type.

- **Does `GetMediaAssetSearchExecutionStatistics` return a `failed` series?** The
  declared response has `new`, `duplicate`, `skipped` and `timing`, and
  `SearchExecutionsStatusChart` plots a fifth series from `stats.failed` -- so
  either the chart has been drawing an empty series for some time, or this is a
  second endpoint whose declaration is incomplete. The chart casts across it for
  now, with the reason at the cast. Answering it means looking at what the
  endpoint actually returns; the aggregate-statistics entry above is why that is
  worth doing rather than assuming the spec is right.

- **`SendAmqpTestMessage` declares a `{ payload }` envelope that nothing
  unwraps.** The controller takes a `TestRequest` body and publishes it to the
  exchange as-is, so a consumer receives `{ payload: ... }` rather than the
  message inside it -- while `apps/site` sends the message flat, which is what
  the media trigger consumer expects and why the workflow button works.
  Whichever side is right, the declaration and the publisher disagree: either
  the controller should publish `request.payload`, or the body should be the
  message. The site casts across it for now, with the reason at the cast
  (`apps/site/src/api/adminApi.ts`). Found by typing that method, 2026-09-29.

### Site

- **Notifications are broadcast to every connected socket.** The gateway's
  `send` is `server.emit`, so every client receives every `notification.push` and
  `notification.refresh` regardless of who it is for -- the REST endpoints are
  per-user, the socket is not. Authenticating the handshake (2026-09-28) stopped
  strangers listening; it did not make the stream per-user. The fix is a room per
  user and emitting to it, which needs the publisher to know the recipient.

- **`public/assets/libs/tinymce` is build output under version control.**
  `next.config.mjs` copies `node_modules/tinymce` into it with
  `copy-webpack-plugin`, so every build rewrites 239 tracked files and `git
status` is only clean while the installed version matches the committed one --
  which is why `tinymce` is pinned to an exact 8.8.2 rather than a caret. The
  directory also holds a `tinymce-premium` overlay that nothing copies: those
  plugin directories are there because somebody put them there, they carry no
  version, and a `tinymce` upgrade leaves them behind. Untracking the directory
  needs the build to reproduce all of it, premium included, which is the site's
  conventions work rather than this phase's.

- **8 `@typescript-eslint/no-explicit-any`**, and nothing else: down from the
  442 warnings across seven rules the site arrived with (2026-09-29).
  `no-unused-vars` went from 277 to zero, and the other five rules are empty.

  All eight are in the OnAir components and their client, and they stay: those
  endpoints are being replaced by the Minerva calendar sync, so typing
  `onairApi` from what the components read would be work thrown away -- the new
  APIs bring their own types. `next.config.mjs` still hides warnings from the
  build with `eslint: { ignoreDuringBuilds: true }`, and they are warnings
  rather than errors in `apps/site/eslint.config.mjs`; both of those change when
  the OnAir move lands and the count reaches zero.

  What the typing turned out to be, for the record, was three kinds of work. A
  generated SDK type existed and had never been reached for -- the meetings
  views, the workflow charts, the notes, the content asset page. Or the data has
  no spec because it does not come from our API: the ffprobe and HandBrake
  metadata and the NZB summary the media pipeline publishes to the CDN
  (`src/utils/ffprobe.ts`, `handbrake.ts`, `nzb.ts`), the notifications socket's
  own envelope (`src/auth/notifications.ts`), the transcription service's
  websocket. Or the `any` was standing in for a library's type that was there
  all along -- antd's `TabsProps["items"]`, react-hook-form's render props,
  React's `DependencyList`, deck.gl's `GoogleMapsOverlayProps`.

  Six bugs came out of it, each one a place where `any` had been hiding that a
  value could be absent: `ContentAssetDetailsPanel` and the asset page both
  rendered before their fetch resolved and read fields off `undefined`;
  `EventChip` and `meetingsApi.toEvent` formatted `Meeting.endTime`, which is
  optional, so an open-ended meeting rendered an invalid date; and
  `DayStatisticsPanel` keyed its attendee tally on the optional `alias`, so
  every attendee without one collapsed into a single unnamed bucket. The
  statistics panel that would crash on a failed fetch and the fourteen demoted
  `"use client"` directives came out of the earlier passes.

  Three things the pass found and did not fix, because they are decisions about
  features rather than about warnings: `OnAirEvent` ignores an `updateFunction`
  prop that `CalendarPanel` still computes and passes, `MovieVideoList` computed
  a per-site video icon that was never rendered (removed), and
  `MediaAssetFFMpegDetails` collects a `chapters` list it never populates, so
  the chapters section can never draw.

  Two more that want a decision rather than a type: `useFetch` declares its data
  as `T` while holding it as `T | undefined`, so every caller is told the value
  is there before the first fetch resolves and after a failure -- which is what
  three of the bugs above actually were, and fixing the signature touches every
  caller. And `src/components/notes/NoteMarkdownEditor.tsx` has no callers and
  never wired its props into `React.FunctionComponent`; it is typed now, but it
  probably wants deleting.

  Turning them into errors, and adopting `@ncfritz/olympus-config/eslint/react`
  in place of the site's own config, wait on the catalog upgrade -- that config
  needs ESLint 9 or later and brings the inline-style ratchet of
  `docs/conventions/ux.md` with it.

- **The site's dependency versions.** Its tooling is behind the workspace
  catalog -- ESLint 8 against 10, TypeScript 5.4 against 6.0, prettier 3.2
  against 3.8, `globals`, `typescript-eslint`, `@types/node` -- and adopting
  `catalog:` for those means two major upgrades whose first effect is new errors
  in code that already has 433 warnings, so it wants doing deliberately rather
  than as part of a tidy-up. Separately and larger: React 18 against the
  catalog's 19, Next 15 against 16, antd 6.4 against 6.6, which the import
  deliberately deferred (`docs/plans/authentication/README.md`, phase 5). Until
  both are done the site is the one workspace package that cannot say
  `catalog:` for anything.

- **Rotate credentials**: `NEXTAUTH_SECRET` and the GitHub OAuth app's
  `GITHUB_CLIENT_SECRET`. Both were committed to `olympus-site` in a
  `.env.local` and lived in its history until the import (2026-09-28), which
  dropped the file from every commit and redacted the values. That does nothing
  about the copies on GitHub and on any machine that has ever cloned the repo,
  so both must be rotated at the source: a new secret for the GitHub OAuth app,
  and `NEXTAUTH_SECRET` retired outright once phase 5 removes NextAuth.

- **Rotate credentials**: the Google Maps API key that was hard-coded in the
  site's `src/pages/_app.tsx`. It stayed in that repository's history through the
  import and was in every bundle the site has ever served, so the value itself
  has to be replaced in the Google console.

  What replaces it does not come back here. The key is read from
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (2026-09-28) and lives in the host's
  `SECRETS_DIR`, reaching `next build` as a buildx secret (2026-09-29) --
  `MAPS_KEY_SECRET` names the file per environment. Compiled into the bundle it
  is public either way, which is what the referrer restriction to `*.ncfritz.net`
  is for and why that restriction is the standing control; keeping the value out
  of this repository is what makes rotating it worth doing at all.

- **Revoke credentials**: the Tomorrow.io API key that was hard-coded in the
  site's weather widget until 2026-09-29. The weather work (ADR 0024, plan
  phase 4) removed Tomorrow.io altogether: the widget, its constant, the
  `tomorrow_key` build secret and `TOMORROW_KEY_SECRET`. The key was in the
  repository and in every bundle served, so it is revoked at Tomorrow.io,
  and `SECRETS_DIR/tomorrow_io_api_key` deleted, once phase 4 is deployed.

- **Rotate credentials**: `src/pages/content.tsx` is a scratch page on the
  public `/content` route whose only content is a `QRCode` for an
  `otpauth://totp/...` URI with a live TOTP seed in it. Whatever account that
  seed belongs to should have its authenticator re-enrolled, and the page
  itself deleted rather than parameterised -- it looks like something used once
  to test the QR component. Both the seed and the Maps key predate this
  repository, so redacting them from history is the same `git filter-repo
--replace-text` pass, if it is worth one.

- `eslint.ignoreDuringBuilds: true` and `reactStrictMode: false` in
  `next.config.mjs`.
- About 1,700 inline style objects in about 225 files.
- Site Docker image uses Node 22; everything else uses Node 26.

### Toolchain drift (resolved by the import)

- TypeScript 5.4 / 5.9 / 6.0; ESLint 8 / 9 / 10; Node 22 / 26.
