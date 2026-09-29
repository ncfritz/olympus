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

## Phase 4 — The widget

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

**Sign-off:** W1–W5 in the site, W9.

## Phase 5 — Stations: ingest and archive

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

## Phase 6 — Rollups, retention, replay

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
   again in the same run.
5. **Metrics**: rollup lag per tier, rows written, rows pruned.
6. **Tests**: each rollup kind against hand-computed buckets (including a
   rain reset and wind around north); tier from tier equals tier from
   samples; reruns are idempotent; pruning; replay of a captured day.

**Sign-off:** W7, W8.

## Phase 7 — Backfill

1. **`AmbientClient`**: `GET /v1/devices/:mac` (up to 288 records,
   `endDate` to page back), rate-limited below 1 request a second,
   `@ExecuteWithMetrics`; the keys never logged and never archived.
2. **Gaps**: at start and hourly, per station, find runs of missing 1m
   buckets longer than 10 minutes within the samples' retention (older
   gaps with an explicit replay), fetch them, archive each response
   (`"source": "backfill"`), store its records as samples with
   `source = backfill` (never replacing a pushed sample), and roll up the
   buckets touched.
3. **Tests**: gap finding; paging; that pushed samples win.

**Sign-off:** W11.

## Phase 8 — Station views

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
