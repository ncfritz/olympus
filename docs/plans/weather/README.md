# Weather: phased implementation plan

The implementation of [ADR 0024](../../decisions/0024-weather-providers.md)
and the [widget design](design.md). Each phase ends in a working,
deployable state and a functional sign-off against
[signoff.md](signoff.md). The Tomorrow.io widget keeps working until
phase 4 replaces it.

| Phase | Delivers                                                                                     | Depends on                                          | Sign-off flows |
| ----- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------- |
| 0     | Accounts, configuration, empty feature in the API and model                                  | —                                                   | —              |
| 1     | Locations: schema and operations                                                             | 0                                                   | W1 (API)       |
| 2     | Forecasts: provider client, cache, degraded answers                                          | 1                                                   | W2, W3 (API)   |
| 3     | Map layers and radar through the API                                                         | 0                                                   | W4, W5 (API)   |
| 4     | The widget's Forecast view; Tomorrow.io removed                                              | 1, 2, 3; sign-in on the site (authentication ph. 5) | W1–W5, W9      |
| 5     | Stations: schema, LAN push, raw archive and its NAS copy                                     | 0                                                   | W6, W10        |
| 6     | Rollups: tiers, retention, replay                                                            | 5                                                   | W7, W8         |
| 7     | Backfill from ambientweather.net                                                             | 6                                                   | W11            |
| 8     | The Stations view, the history page and the series operation                                 | 4, 6                                                | W12            |
| 9     | Weather data in dev: the relay of live pushes, replay for history (ADR 0025)                 | 5, 6                                                | W13            |
| Later | NOAA radar for US locations; One Call (a new ADR); other stations and sensors as metric rows |                                                     |                |

Phases 1–3 and 5–7 are API work: the forecast line (1–4) and the
station line (5–8) are independent of each other after 0.

## Where the code goes

| What                | Where                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Model shapes        | `packages/model`, Olympus domain: `weather/` (locations, forecast, radar, stations)                                    |
| API feature         | `apps/api/src/olympus/weather/`: `WeatherModule`, `controllers/`, `services/`, `providers/`, `converters/`, `queries/` |
| Provider clients    | `apps/api/src/olympus/weather/providers/`: `OpenWeatherClient`, `RainViewerClient`                                     |
| Configuration       | `weatherConfig` in `apps/api/src/config/configuration.ts`                                                              |
| Schema              | `infra/hasura/migrations/olympus/<ts>_weather_*`, with metadata                                                        |
| Site                | `apps/site/src/components/widgets/weather/`, `src/api/weatherApi.ts`, `src/pages/weather/stations.tsx`                 |
| LAN ingest listener | `infra/docker/nginx/weather-ingest.conf`                                                                               |

The operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Every controller is thin; the services own the
Hasura documents and the provider calls.

## Configuration

Added to `readConfig()`, `dev.env.example`, the API README table and
`infra/docker/env/<env>/olympus-api.env`. Secrets arrive as `NAME_FILE`
(ADR 0019).

| Variable                             | Default | What                                                                                                                         |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `OPENWEATHER_API_KEY`                | —       | Optional. Without it the forecast and map-layer operations answer 503 and boot logs a warning. Secret `openweather_api_key`. |
| `WEATHER_FORECAST_TTL_SECONDS`       | `900`   | How long a fetched forecast is served before it is refetched                                                                 |
| `WEATHER_FORECAST_MAX_STALE_SECONDS` | `21600` | How long the last good forecast is served, marked stale, while the provider fails                                            |
| `WEATHER_TILE_CACHE_MB`              | `128`   | The tile cache's size; least recently used tiles go first                                                                    |
| `WEATHER_TILE_TTL_SECONDS`           | `1800`  | OpenWeather layer tiles; radar tiles live as long as their frame is listed                                                   |
| `WEATHER_PROVIDER_TIMEOUT_MS`        | `5000`  | Per provider call                                                                                                            |
| `WEATHER_STATION_RETENTION_DAYS`     | `30`    | Readings older than this are deleted                                                                                         |
| `WEATHER_STATION_STALE_SECONDS`      | `600`   | A station with no reading for this long is "not reporting"                                                                   |
| `WEATHER_STATION_ALLOWED_CIDRS`      | —       | Required for the push route to accept anything: the LAN ranges the consoles are on                                           |

## Phase 0 — Accounts and scaffolding — done 2026-09-29

1. **ADR 0024 accepted**: **done** 2026-09-29.
2. **OpenWeather**: **done** — a free account with no payment method; the key in
   `${SECRETS_DIR}/openweather_api_key`, mounted as a Compose secret on
   the API. It never reaches the site.
3. **Google**: **done** — the Places API (New) enabled on the existing Maps key,
   which stays restricted by referrer.
4. **`weatherConfig`**: **done** — the variables above, validated at
   boot; the key as the `openweather_api_key` Compose secret.
5. **`olympus/weather`**: **done** — `WeatherModule` in `OLYMPUS_MODULES`,
   no operations yet; it warns at boot without the key or the push
   ranges. The model's `olympus/weather.ts` arrives with phase 1's shapes.

**Sign-off:** the API boots with and without the key, and the Turbo
tasks pass.

## Phase 1 — Locations — built 2026-09-29, applied to `hasura-dev`; W1 open

1. **Migration** `1790720000000_weather_locations` in the `olympus`
   schema: `id` (uuid), `user_id` (references `users`, cascade on delete),
   `label` (not blank), `place_id` and `place_name` (Google; optional),
   `latitude`, `longitude` (checked ranges), `position`, `is_default`,
   `created_at`, `updated_at` (the shared trigger). Unique
   `(user_id, position)`, deferred to commit, so a reorder is one
   transaction; a partial unique index allows one default per user.
   Hasura: admin only, custom column names in camelCase.
2. **Operations**, each `@RequiresIdentity()` and scoped to the caller's
   `userId`, so another user's location is a 404, never a 403:

   | Operation                 | Route                                  |
   | ------------------------- | -------------------------------------- |
   | `ListWeatherLocations`    | `GET /weather/locations`               |
   | `CreateWeatherLocation`   | `POST /weather/locations`              |
   | `DescribeWeatherLocation` | `GET /weather/location/:locationId`    |
   | `UpdateWeatherLocation`   | `PUT /weather/location/:locationId`    |
   | `DeleteWeatherLocation`   | `DELETE /weather/location/:locationId` |
   | `ReorderWeatherLocations` | `PUT /weather/locations/order`         |

   Create appends at the end and answers with a `Location` header; the
   first location a user adds becomes the default. Update changes the
   label or the default (a different place is a new location); setting a
   default clears the old one in the same mutation
   (`SetDefaultWeatherLocation`), and an empty change is a 304. Deleting
   the default leaves none (the widget falls back to the first). Reorder
   takes every one of the caller's IDs exactly once. The API validates
   the body itself (the global `ValidationPipe` is off), and a location
   ID that is not a UUID is a 400 before Hasura.

3. **Tests**: converter units; endpoint tests for each operation,
   including another user's id (404), no identity (401) and bad input
   (400, before Hasura). The migration applied over the baseline in a
   scratch Postgres, with its constraints and `down.sql` exercised.

**Sign-off:** W1 against the API from its OpenAPI page.

## Phase 2 — Forecasts — built 2026-09-29, not signed off

1. **`OpenWeatherClient`**: `current` and `forecast` (5 day / 3 hour) for a
   coordinate with `units=imperial`; each method `@ExecuteWithMetrics`
   (ADR 0017, server `openweather`); the key sent as `appid` and never
   logged, with the URL redacted in errors.
2. **`WeatherForecastService.describe(locationId, principal)`**: looks up
   the caller's location, then the cache, keyed by the coordinate rounded
   to two decimals.
   - A hit younger than the TTL is returned as is.
   - A miss, or an expired entry, fetches both calls. Concurrent misses
     for one key share a single fetch.
   - If the fetch fails and the entry is younger than the maximum stale
     age, the old one is returned with `stale: true`; otherwise 503.
   - The cache is in memory: one API instance, and a restart costs one
     call per location.
3. **Shaping**, in the service and unit-tested against captured
   responses: `current` (conditions, feels like, wind and gust, humidity,
   dew point, pressure in inHg and hPa, visibility in miles, cloud cover,
   sunrise, sunset); `next` (eight 3-hour steps); `days` (five local days
   by the forecast's own UTC offset: high, low, the most significant
   condition, the highest chance of precipitation); `fetchedAt`, `stale`.
   Today's high and low come from the steps as well as the current
   reading. Condition icons are OpenWeather's condition ids mapped to the
   site's four icon kinds, in the model so the site does no mapping.
4. **Operation** `DescribeWeatherForecast`:
   `GET /weather/location/:locationId/forecast`. A forecast is asked for
   by location, never by coordinate, so the API only ever spends its
   provider budget on places someone keeps.
5. **Metrics**: `weather_cache_requests_total{cache, result}` (hit, miss,
   stale) beside the client histogram.
6. **Tests**: the client mocked in the Nest testing module; hit, miss,
   coalesced misses, stale on failure, 503 past the stale limit, a key
   that is missing, a 401 and a 429 from the provider.
7. **As built**: `axios` joins the pnpm catalog for the API's client. The
   model's `WeatherForecast` carries `current`, `next`, `days`,
   `utcOffsetSeconds`, `fetchedTime` and `stale`, with each condition as a
   `WeatherConditionKind` (thunderstorm, snow, rain, drizzle, fog, cloudy,
   partly cloudy, clear) beside the provider's own words. The cache holds
   the provider's responses and shapes them on every read, so "next" and
   "today" start at the moment of the request even from a stale entry. A
   day's condition is its most significant wet weather with at least a 50%
   chance, otherwise what its daytime steps show most. Provider failures
   are logged once per place every ten minutes, without the URL (which
   carries the key).
8. **Forecast history** (added after the widget): the free forecast starts
   at the next step, so a day built from it alone lost its morning as the
   day went on, and by the evening today's high and low were the evening's.
   Every fetch is now also kept in Postgres
   (`weather_forecast_steps`, the last forecast of each step, and
   `weather_observed_temperatures`, each fetch's current temperature),
   per place (the cache's rounded coordinate), for 48 hours, pruned at most
   hourly. Today is built from the place's history since local midnight as
   well as the snapshot (the snapshot's step wins at the same time), so
   its high, low, chance and amount of rain and condition are the whole
   day's; `next` is the snapshot's alone. Writing or reading the history
   failing is logged and the forecast is served from the snapshot, as
   before. Each step also carries feels like, humidity and pressure, for
   the widget's 24-hour curve.

**Sign-off:** W2, W3 against the API.

## Phase 3 — Map layers and radar — built 2026-09-29, not signed off

1. **Layer tiles**: `GetWeatherMapTile`
   `GET /weather/map/:layer/:z/:x/:y` for `temperature`, `precipitation`,
   `clouds`, `wind`, `pressure` (OpenWeather's `*_new` layers). Anything
   else is a 400.
2. **Radar**: `RainViewerClient` reads the frame list
   (`weather-maps.json`, cached five minutes).
   `ListRadarFrames` `GET /weather/radar/frames` returns the past frames
   (time and an opaque id); `GetRadarTile`
   `GET /weather/radar/:frameId/:z/:x/:y` answers only for a listed frame
   and for `z ≤ 7`: the site overzooms.
3. **Tile cache**: one `lru-cache` bounded by bytes
   (`WEATHER_TILE_CACHE_MB`), keyed by provider and tile; radar tiles
   expire with their frame. Responses carry `Cache-Control: private` and
   a `max-age` matching the entry's remaining life, so the browser holds
   them too.
4. **Rate guards**: a token bucket in front of each provider, under its
   limit (OpenWeather 60 a minute shared with forecasts, reserving room
   for them; RainViewer 100 a minute). An empty bucket answers a cached
   tile if there is one, otherwise 503; forecasts are never starved by
   tiles.
5. **Tests**: layer and frame validation, cache hits, the byte bound, the
   guard.
6. **As built**: layer zoom is limited to 0–10 (the widget sits at 8),
   radar to 0–7, and a tile off the map at its zoom is a 400 before any
   provider call. Radar is RainViewer's one remaining free scheme
   (Universal Blue, 256-pixel, smoothed, snow shown); a frame's ID is its
   capture time, and its tiles are cached for as long as it is listed
   (2 hours 10 minutes from capture). The frame list is refetched every
   five minutes and served for up to 30 minutes while RainViewer fails.
   OpenWeather's allowance is one bucket of 55 a minute shared with
   forecasts, of which tiles may not take the last 10; RainViewer's is 90
   a minute. `lru-cache` is the API's only new dependency.

**Sign-off:** W4, W5 against the API.

## Phase 4 — The widget — built 2026-09-29, not signed off

1. **`src/api/weatherApi.ts`** over the regenerated SDK.
2. **Components** in `components/widgets/weather/`, one per file, styled
   with `createStyles` (no new inline style objects): `WeatherWidget`
   (card, header, view switch), `LocationMenu`, `ManageLocationsModal`,
   `PlaceSearch`, `CurrentConditions`, `NextHours`, `FiveDays`,
   `WeatherMap`, `MapLayerPicker`, `RadarTimeline`,
   `WeatherAttribution`, and the states (`Loader`, `ErrorBlock`, the
   stale banner, the empty card).
3. **Map**: the existing Google map and deck.gl overlay, zoom 8 fixed.
   Tiles are fetched in the `TileLayer`'s `getTileData` through
   `weatherApi`, so they carry the user's credentials; the radar layer's
   `maxZoom` is 7. Radar playback preloads the frames' tiles before it
   starts and loops every 500 ms.
4. **Places**: `useMapsLibrary("places")`, `AutocompleteSuggestion`
   with a session token per search, then `Place.fetchFields` for
   `displayName`, `formattedAddress` and `location`; "Powered by Google"
   under the suggestions.
5. **Location switching** re-renders every panel from one selected id;
   the forecast is refetched when the id changes and every 15 minutes
   while the page is visible.
6. **Remove Tomorrow.io**: `TOMORROW_IO_API_KEY`,
   `NEXT_PUBLIC_TOMORROW_IO_API_KEY`, the `tomorrow_key` build secret in
   `infra/docker/next/Dockerfile` and `docker-bake.hcl`,
   `TOMORROW_KEY_SECRET` in the env files, `WeatherForecastWidget.tsx`;
   the roadmap's rotation item becomes "revoke the key".
7. **Tests**: components with React Testing Library and the SDK mocked:
   the location switch, each state, the day grouping's rendering.
8. **As built**:
   - The site's tests are node-only by design (`apps/site/vitest.config.mts`:
     no React, no DOM), so the logic the components need is pure
     functions in `src/utils/weather.ts` (times at the location's offset,
     day labels, the shared range bars, which location opens, list moves,
     the radar loop), unit-tested; the components themselves are signed
     off by W1–W5.
   - Styles are a CSS module (`WeatherWidget.module.css`): the site has no
     `antd-style`, and a module needs no new dependency. Two inline styles
     remain where the value is data (a range bar's position, a legend
     swatch's colour).
   - Locations reorder by dragging a handle (`@dnd-kit`: pointer, touch
     and keyboard). The default is a green button with a check when set
     and green text when not; remove is a danger button.
   - The five days' bars are coloured by temperature: one colour scale
     (`TEMPERATURE_STOPS`) from 10 °F to 95 °F, each bar a gradient from
     its low to its high through every stop it crosses.
   - The Stations view switch arrives with phase 8; until then the widget
     is the Forecast view alone.
   - Signed out, the widget says to sign in; the locations are the user's.
   - `@types/google.maps` joins the site's dev dependencies for the Places
     types, and `@dnd-kit/core`, `/sortable` and `/utilities` its
     dependencies for the drag.

**Sign-off:** W1–W5 in the site, W9.

## Phase 5 — Stations: ingest and archive — built 2026-09-29, not signed off

Starts with one station, the WS-5000 on firmware 4.3.8, which takes a
host name as well as an address for its custom server. The second is at
another site; it follows once the firewall between the sites lets its
console reach the ingest listener, and its range stays in
`WEATHER_STATION_ALLOWED_CIDRS` until then.

1. **Migration**:
   - `weather_stations`: `id`, `name`, `mac_address` (`macaddr`,
     unique), `created_at`, `updated_at`.
   - `weather_station_samples`: `id`, `station_id` (cascade),
     `observed_at` (the console's `dateutc`), `received_at`, `source`
     (`push` or `backfill`), and a column per reading in the console's own
     units, decided from captured requests: outdoor and indoor
     temperature and humidity, dew point and feels like (derived when the
     push lacks them), wind speed, gust and direction, rain rate and the
     daily total, relative and absolute pressure, UV, solar radiation,
     battery. Unique `(station_id, observed_at)`, which is also the index.
2. **Station registration**: `CreateWeatherStation`,
   `UpdateWeatherStation`, `DeleteWeatherStation`, `@Roles("admin")`, no
   UI; used from the OpenAPI page.
3. **Push**: `ReportWeatherStationReading`
   `GET /weather/station/report`, `@Public()`. It accepts the request
   only from `WEATHER_STATION_ALLOWED_CIDRS` (by the forwarded address)
   and only for a registered `PASSKEY`; anything else is a 403, counted
   and logged once per MAC per hour without the query string. The
   console's malformed query (`path&PASSKEY=…` when the path has no
   `?`) is normalized by the ingest listener. A repeated
   `(station, observed_at)` is ignored.
4. **Archive**: before parsing, the request is appended as one line to
   `<archive>/<mac>/<yyyy>/<mm>/<dd>.jsonl` (UTC days):
   `{"receivedAt", "source": "push", "remote", "query"}`. The first write
   of a day compresses the previous day to `.jsonl.zst` and records its
   SHA-256 beside it. A write that fails is logged and counted; the
   sample is still stored.
5. **Ingest listener**: `weather-ingest.conf`, an HTTP server on the
   internal name `weather.internal.ncfritz.net` (or the Mac Mini's
   address, if the console takes only an IP; the consoles cannot do
   TLS), `allow` for the LAN ranges and `deny all`, proxying the one path
   to the API. The public server blocks that path outright.
6. **Consoles**: each WS-5000's Customized upload set to the listener,
   path `/weather/station/report?`, the shortest interval it offers;
   `docs/guides/weather-stations.md` records the settings, registering a
   station and capturing a request for a test fixture.
7. **NAS copy**: an Airflow DAG, nightly, copies finished `.jsonl.zst`
   days to the `Weather` share on `nfs01.sea.ncfritz.net`, checks each
   against its SHA-256, and removes local days older than 30 days only
   once their copy has checked out.
8. **Database backup**: the weather tables' data is excluded from the
   Postgres backup (`--exclude-table-data`), the schema is not.
9. **Tests**: parsing from captured requests of both consoles; the CIDR
   and MAC checks; the duplicate; the archive line and the day rollover.

**Sign-off:** W6, W10.

**As built.** Where it differs from the list above:

- Listing and describing stations (`ListWeatherStations`,
  `DescribeWeatherStation`) are there for every signed-in user, for the
  station views; only registering, renaming and removing are an admin's.
  A rename is the only update: a console's MAC is its identity.
- The sample columns are every reading the WS-5000 sends: wind as
  instant, 10-minute average and gust, with the day's maximum gust; rain
  as rate, event, day, week, month and year; both batteries. Dew point
  and feels-like are derived (`utils/meteorology.ts`) when the push lacks
  them. Unknown parameters are not stored but stay in the archive.
- The address check is the API's alone. nginx does no `allow`/`deny` of
  its own: behind Docker Desktop's port publishing the address nginx sees
  may not be the console's, and two lists of ranges are one more to keep
  in step. The ingest listener replaces `X-Forwarded-For` with what it
  saw, so a console cannot claim an address; the archive's `remote` shows
  what the API was given, which is how W6 checks it.
- No query normalization: the console's path ends in `?`, so its
  `&PASSKEY=…` lands in the query. A path without the `?` is a 404, which
  the guide warns about.
- The public block is a regex on the normalized path, so the trailing
  slash the API's routing accepts is refused too.
- The NAS copy is `infra/airflow/dags/olympus_weather_archive.py` over an
  NFS volume the Docker daemon mounts (`WEATHER_NAS_HOST`,
  `WEATHER_NAS_EXPORT` in `prod.env`); the backup excludes
  `olympus.weather_station_samples`' rows. Phase 6 adds the rollups to
  that list.

## Phase 6 — Rollups, retention, replay — built 2026-09-29, not signed off

1. **Migration**:
   - `weather_metrics`: `id`, `name` (`outdoor_temperature`, …), `unit`,
     `rollup` (`mean`, `sum`, `max`, `vector_x`, `vector_y`), seeded
     with the WS-5000's readings.
   - `weather_rollup_tiers`: `name`, `bucket` (interval), `retention`
     (interval, null for always), `source_tier`; seeded 1m, 5m, 15m, 30m,
     1h.
   - `weather_station_rollups`: `station_id`, `metric_id`, `tier`,
     `bucket_start`, `sample_count`, `sum`, `min`, `max`, `first`,
     `last`; primary key `(station_id, metric_id, tier, bucket_start)`.
   - SQL functions, `VOLATILE`, tracked in Hasura as mutations:
     `weather_rollup_samples(from, to)` builds 1m from samples,
     `weather_rollup_tier(tier, from, to)` builds a tier from its source
     tier, `weather_prune()` applies every retention. Each upserts whole
     buckets, so a rerun rewrites rather than adds.
2. **Derived metrics**: rain per sample from the daily total (a drop is a
   reset: the new total is the amount); wind as speed × sin and cos of
   the direction; dew point and feels like where the push lacks them.
3. **Schedule** (`@nestjs/schedule`, one API instance): every minute, the
   1m buckets that closed at least 30 seconds ago; each coarser tier as
   its buckets close, a minute behind its source; hourly, pruning. A run
   that falls behind (the API was down) catches up from the last bucket
   it wrote, within the samples' retention.
4. **Replay**: `ReplayWeatherArchive` (`@Roles("admin")`, `202`) and
   `pnpm --filter @ncfritz/olympus-api weather:replay --from --to` read
   the archive for a range (local days, or a restored copy from the NAS),
   upsert the samples, and rebuild every tier for the buckets touched.
   Samples older than their retention are loaded, rolled up and removed
   again in the same run. Built on one ingest function, an archive line
   in (a push's query or a backfill response), which the push path and
   phase 9's relay use too ([ADR 0025](../../decisions/0025-weather-data-in-dev.md)):
   a source directory and a target environment are arguments, so dev
   replays from the NAS copy or from prod's archive directory on the Mac
   Mini, including today's unsealed file. Two modes: ignore repeats (the
   default) and replace them (after a parser fix).
5. **Metrics**: rollup lag per tier, rows written, rows pruned.
6. **Tests**: each rollup kind against hand-computed buckets (including a
   rain reset and wind around north); tier from tier equals tier from
   samples; reruns are idempotent; pruning; replay of a captured day.

**Sign-off:** W7, W8.

**As built.** Where it differs from the list above:

- `weather_metrics` has a `source` column naming the samples column (or
  derived value: `rain_in`, `wind_x_mph`, `wind_y_mph`) it rolls up, with a
  check listing the allowed ones; the function picks the value by name
  with `to_jsonb`, so a metric over an existing column is a row. `uv_index`
  and `rain_rate` default to `max`; all six statistics are kept for every
  metric regardless. Metrics are 16: outdoor and indoor temperature and
  humidity, dew point, feels like, wind speed, gust and its two
  components, rain, rain rate, both pressures, UV, solar radiation.
- `weather_rollup_tiers.built_until` records how far each tier is built;
  the functions move it forward only, and never past now, so a replay of
  old or current days cannot confuse the schedule.
- Hasura needs a tracked table as a mutation function's return type:
  `weather_rollup_results` (tier, rows written, rows pruned), which holds
  no rows, like `minerva.*_statistics_type`.
- Rain from the daily total looks back up to a day for the previous
  sample; with none, a sample's amount is 0.
- Schedule: `setInterval`, no new dependency. Every minute each tier is
  built from a bucket before its `built_until` (so late arrivals land) up
  to 30 seconds ago (1m) or its source's `built_until`; hourly, pruning,
  which keeps samples the 1m tier has not reached and the day before them.
  Neither runs while a replay does. `WEATHER_ROLLUPS_ENABLED` (default on)
  turns it off for the tests and a second API.
- Ingest is one service, `WeatherIngestService`: archive lines in, parsed
  with this environment's parser, one insert per batch; the push path now
  goes through it (same answers, same metrics), and phase 9's import will.
  Backfill lines are counted and skipped until phase 7.
- Replay reads `.jsonl.zst` once its checksum exists, else the plain file,
  so today's unsealed day replays too. Per day: ingest in batches of 500,
  every tier for the day, then prune with the finished day kept for the
  next day's rain. `ReplayWeatherArchive` reads only the API's own
  archive; `weather:replay` (built like `auth:user`) takes `--dir`,
  `--station` and `--replace`.
- The rollups' rows are left out of the backup too.
- `infra/hasura/tests/weather_rollups.sql` checks the functions against
  hand-computed buckets (a rain reset, wind across north, tier from tier,
  reruns, pruning), in a transaction it rolls back.

## Phase 7 — Backfill — built 2026-09-29, not signed off

1. **`AmbientClient`**: `GET /v1/devices/:mac` (up to 288 records,
   `endDate` to page back), rate-limited below 1 request a second,
   `@ExecuteWithMetrics`; the keys never logged and never archived.
2. **Gaps**: at start and hourly, per station, find runs of missing 1m
   buckets longer than 10 minutes within the samples' retention (older
   gaps with an explicit replay), fetch them, archive each response
   (`"source": "backfill"`), store its records as samples with
   `source = backfill` (never replacing a pushed sample), and roll up the
   buckets touched.
3. **Prod only**: `WEATHER_BACKFILL_ENABLED`, true in prod alone. Dev
   receives backfill responses as archive lines, through the relay and
   replay (ADR 0025).
4. **Tests**: gap finding; paging; that pushed samples win; nothing is
   fetched with backfill off.

**Sign-off:** W11.

**As built.** Where it differs from the list above:

- Gaps are found from the samples themselves, not the 1m tier: stretches
  of more than 10 minutes with no sample between retention less an hour
  and 15 minutes ago (the newest stretch may still be arriving), including
  before the first sample and after the last.
- Each gap is fetched from its end backwards, a page ending a millisecond
  before the previous page's oldest record, until a page reaches the
  gap's start, Ambient has nothing older, or a page does not move back.
  Requests are queued one at a time, at least 1.1 seconds apart. Every
  page is archived whole, as `{"receivedAt", "source": "backfill",
"response"}`, then stored through the shared ingest path; each tier is
  rebuilt over the whole hours the gap touched.
- "Never replacing a pushed sample" is in the insert itself: a push
  replaces a backfilled reading of the same moment, a backfilled reading
  never replaces anything, and a replay after a parser fix (`replace`)
  replaces a push with a push and a backfilled reading with a backfilled
  one. Within one batch a push outranks a record of the same moment.
- Older history is an admin's `BackfillWeatherStations`
  (`POST /weather/stations/backfill`, `202`): a range of UTC days, oldest
  first so each day's rain is measured from the day before, every day
  rolled up as it is stored. The retention pruning then removes the
  samples; the tiers keep them.
- The rollup schedule waits while a backfill runs, as it does for a
  replay.
- Ambient records are read as the upload's query (the field names are the
  same; `dateutc` is epoch milliseconds), so one parser serves both.
- The relay carries a backfill response as `responseJson`, text, since the
  model has no free-form objects; the import parses it.
- The keys are the `ambient_application_key` and `ambient_api_key` Compose
  secrets. `WEATHER_BACKFILL_ENABLED` without them warns and does nothing.
- `weather_backfill_records_total{result}` (fetched, stored), and the
  client's calls under `Device.Data` with the other provider metrics.

## Phase 8 — Station views — Stations view built 2026-09-29; history page to come

1. **Operations**:
   - `ListWeatherStations` `GET /weather/stations`: each station with its
     latest sample and whether it is reporting (against
     `WEATHER_STATION_STALE_SECONDS`).
   - `ListWeatherStationSeries`
     `GET /weather/station/:stationId/series?metrics=&from=&to=&resolution=`:
     for each metric, points of time, average, minimum, maximum (and sum
     for rain). `resolution` is a tier or `auto`: the finest tier whose
     retention covers `from` and whose points fit in 2,000. Wind
     direction is recombined from its components here. The operation is
     general on purpose, for the other historical displays to come.
   - Both `@RequiresIdentity()`: stations are the house's, shared by every
     user.
2. **Site**: the widget's Stations view (`StationsView`, `StationCard`,
   a 24-hour sparkline) refreshed every minute while visible; the page
   `/weather/stations` with the station choice, range presets, a date
   range picker, the resolution, summary tiles and the charts (average
   line, minimum–maximum band), using the chart library the site already
   has.
3. **Tests**: operations, including the `auto` choice at each tier's
   edge; the not-reporting state; the page's ranges.

**Sign-off:** W12.

**As built so far** (the operations and the widget's Stations view):

- `ListWeatherStations` and `DescribeWeatherStation` carry
  `latestReading` (the newest sample, nulls left out, marked `push` or
  `backfill`) and `reporting` (that reading within
  `WEATHER_STATION_STALE_SECONDS`), from one nested query. A station with
  no sample in the samples' retention has no reading and is not
  reporting.
- `ListWeatherStationSeries` points carry the bucket's count, mean
  (sum ÷ count), minimum, maximum, sum, first and last. Besides the
  tiers there is `1d`, whole UTC days combined from the hourly tier in
  the API, which is exact (counts and sums add, extremes carry) and is
  what lets a year fit in 2,000 points; `auto` picks it past about 83
  days. A week at `5m` is 2,016 points, so `auto` gives a week at `15m`.
  Metrics are checked against `weather_metrics` (plus `wind_direction`),
  at most 12 a request. Tier retentions come from Postgres's interval
  text.
- The widget is AntD tabs, Forecast and Stations, under a "Weather"
  heading of its own line, like the site's other tabbed panels: the tab
  bar sits on the blue rule in place of AntD's grey line, with the
  location menu as its extra content at the right (Forecast only). The
  locations are fetched above the tabs for that. A hidden tab's content is
  dropped (`destroyOnHidden`), so Stations polls only while shown. The tab
  is remembered per browser (`weather.view`).
- An admin registers a station from the Stations tab (`RegisterStationModal`,
  CreateWeatherStation): **Register station** in the tab bar, or **Register
  a station** when there are none. The MAC is checked as the API checks it
  before sending, and the API's refusal (a MAC already registered) shows in
  the modal. Others see the tab without either. The Stations view polls every minute while
  the page is visible without the site's error notification (a failed
  refresh keeps the last readings and says so), and moves "12 s ago" on
  every ten seconds. Each card's sparkline is the last 24 hours of
  outdoor temperature at `15m`, refreshed every five minutes, the line
  broken across gaps longer than two buckets. A backfilled newest reading
  says so under the tiles.
- The design's History link waits for the history page.

## Phase 9 — Weather data in dev — built 2026-09-29, not signed off

[ADR 0025](../../decisions/0025-weather-data-in-dev.md). Needs phase 6's
replay; independent of 7 and 8, so it can follow 6 directly.

1. **Message**: `WeatherArchiveLine` in `packages/messages` (the MAC and
   the archive line) and the fanout exchange `weather.station.reports`.
2. **Publish**: `StationArchive.append` publishes each line it writes,
   after writing it, when `WEATHER_RELAY_PUBLISH=true` (prod only). A
   failed publish is logged once per ten minutes and counted
   (`weather_relay_publish_total{result}`); the push is unaffected.
3. **Broker** (`infra/docker/rabbitmq`): the `rabbitmq_shovel` plugin in
   the image; in `users.json`, the two exchanges and a user,
   `weather-shovel`, with exactly `/dionysus` and `/dionysus-dev`;
   `definitions.mjs` writes the exchanges and a shovel from
   `/dionysus`'s `weather.station.reports` to `/dionysus-dev`'s. First
   check whether a definitions-imported shovel can use the local direct
   URI (`amqp://`), which would make the user unnecessary. The
   definitions test covers the shovel's vhosts and that no other user
   gains a vhost.
4. **Import**: `ImportWeatherStationReadings`
   `POST /weather/station/readings`, `@Roles("agent")`, up to 500 lines:
   each through phase 6's ingest function in ignore mode, no address
   check, no archive write; a MAC this environment does not know is
   skipped. Answers the counts (stored, duplicate, unknown station,
   invalid).
5. **Agent**: `agents/olympus-weather-relay`, from the agent generator
   and `docs/conventions/agent.md`. It declares
   `weather.station.reports.<WEATHER_RELAY_QUEUE>` (default
   `olympus_dev`) on `/dionysus-dev` with a 48-hour message TTL, at most
   30,000 messages with the oldest dropped, and a 7-day expiry; consumes
   in batches of up to 500 or 5 seconds; acknowledges a batch once the
   import answers. It runs in `local` and from the IDE. No prod image.
6. **Docs**: the stations guide gains "Weather data in dev": replay after
   `refresh-dev` or on a new machine, then start the relay; which queue
   name a laptop with its own database uses.
7. **Tests**: the publish on and off, and a broker failure not failing
   a push; the import's counts and that it neither archives nor checks
   addresses; the agent's batching and acknowledgement; the definitions.

**Sign-off:** W13.

**As built.** Where it differs from the list above:

- The message is `WeatherArchiveLineMessage` (`macAddress`, `line`) on
  `weather.station.reports`, routing key `weather.archive.line`; the API's
  `ArchiveLine` is now the contract's `WeatherArchiveLine`.
- Publishing is `StationRelay`, which `StationArchive.append` calls after
  a line is written, not awaited: the connection manager holds messages
  while the broker is away, and the push does not wait for it.
  `weather_relay_publish_total{result}`.
- The broker's definitions gained `exchanges` (both vhosts, so the shovel's
  ends exist before any service declares them), per-vhost `permissions`
  for a user (`weather-shovel` reads prod's exchange through a server-named
  queue and writes only dev's exchange), and `shovels`, written as dynamic
  shovel parameters with `ack-mode: on-confirm`. The URIs carry the user's
  password (the definitions file is a secret). The local direct URI was
  not used: a user with only these permissions is easier to reason about
  than whichever identity a definitions-imported shovel would run as. The
  image enables `rabbitmq_shovel` and `rabbitmq_shovel_management`.
- The import's shape is `records: WeatherArchiveRecord[]` (the line's
  fields with its MAC, flat), up to 500, `@RequiresIdentity()` and
  `@Roles("agent")`; answers the counts. Backfill lines carry no response
  in the record yet; phase 7 adds it.
- The agent handles one line at a time (`prefetchCount: 1`) rather than
  batches: the agent conventions' handler shape, and a two-day backlog is
  about 21,600 calls, minutes of work. A line the API answers for is
  acknowledged whatever it made of it; one it does not answer for goes
  back on the queue after 5 seconds, doubling to a minute. The queue name
  comes from `WEATHER_RELAY_DATABASE`, bound as a named handler in
  `RabbitModule` since a decorator cannot read configuration.
  `weather_relay_lines_total{result}`.
- `scripts/dev-ca.sh` issues `olympus-weather-relay-agent`, and the API's
  env examples list it in `AUTH_SERVICE_ROLES`.
- Two test helpers from earlier phases were loosely typed and failed the
  API's `typecheck` task; fixed here.
