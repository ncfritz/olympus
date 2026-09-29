# Weather: phased implementation plan

The implementation of [ADR 0024](../../decisions/0024-weather-providers.md)
and the [widget design](design.md). Each phase ends in a working,
deployable state and a functional sign-off against
[signoff.md](signoff.md). The Tomorrow.io widget keeps working until
phase 4 replaces it.

| Phase | Delivers                                                        | Depends on                                          | Sign-off flows |
| ----- | --------------------------------------------------------------- | --------------------------------------------------- | -------------- |
| 0     | Accounts, configuration, empty feature in the API and model     | —                                                   | —              |
| 1     | Locations: schema and operations                                | 0                                                   | W1 (API)       |
| 2     | Forecasts: provider client, cache, degraded answers             | 1                                                   | W2, W3 (API)   |
| 3     | Map layers and radar through the API                            | 0                                                   | W4, W5 (API)   |
| 4     | The widget's Forecast view; Tomorrow.io removed                 | 1, 2, 3; sign-in on the site (authentication ph. 5) | W1–W5, W9      |
| 5     | Stations: schema, LAN push, retention                           | 0                                                   | W6, W8         |
| 6     | The Stations view and the station history page                  | 4, 5                                                | W7             |
| Later | NOAA radar for US locations; One Call (a new ADR); more history |                                                     |                |

Phases 1–3 and 5 are API work and independent of each other after 0;
phase 5 can go first if the stations matter more than the forecast.

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

## Phase 0 — Accounts and scaffolding

1. **ADR 0024 accepted.**
2. **OpenWeather**: a free account with no payment method; the key in
   `${SECRETS_DIR}/openweather_api_key`, mounted as a Compose secret on
   the API. It never reaches the site.
3. **Google**: the Places API (New) enabled on the existing Maps key,
   which stays restricted by referrer.
4. **`weatherConfig`** with the variables above, validated at boot.
5. **`olympus/weather`**: `WeatherModule` added to `OLYMPUS_MODULES`,
   with no operations yet; `packages/model` gets the `weather/` folder.

**Sign-off:** the API boots with and without the key, and the Turbo
tasks pass.

## Phase 1 — Locations

1. **Migration** `weather_locations` in the `olympus` schema: `id` (uuid),
   `user_id` (references `users`, cascade on delete), `label`,
   `place_id` (Google), `place_name` (Google's formatted name),
   `latitude`, `longitude` (checked ranges), `position`, `is_default`,
   `created_at`, `updated_at`. Unique `(user_id, position)`, deferrable,
   so a reorder is one statement; a partial unique index allows one
   default per user. Hasura: admin only.
2. **Operations**, each `@RequiresIdentity()` and scoped to the caller's
   `userId`, so another user's location is a 404, never a 403:

   | Operation                 | Route                                  |
   | ------------------------- | -------------------------------------- |
   | `ListWeatherLocations`    | `GET /weather/locations`               |
   | `CreateWeatherLocation`   | `POST /weather/location`               |
   | `UpdateWeatherLocation`   | `PATCH /weather/location/:locationId`  |
   | `DeleteWeatherLocation`   | `DELETE /weather/location/:locationId` |
   | `ReorderWeatherLocations` | `PUT /weather/locations/order`         |

   Create appends at the end; the first location a user adds becomes the
   default; setting a default clears the old one in the same mutation;
   deleting the default leaves none (the widget falls back to the
   first).

3. **Tests**: converter units; endpoint tests for each operation,
   including another user's id (404) and no identity (401).

**Sign-off:** W1 against the API from its OpenAPI page.

## Phase 2 — Forecasts

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

**Sign-off:** W2, W3 against the API.

## Phase 3 — Map layers and radar

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

## Phase 5 — Stations

1. **Migration**:
   - `weather_stations`: `id`, `name`, `mac_address` (`macaddr`,
     unique), `created_at`, `updated_at`.
   - `weather_station_readings`: `id`, `station_id` (cascade),
     `observed_at` (the console's `dateutc`), `received_at`, and a column
     per reading the WS-5000 sends, in its own units (°F, mph, inHg, in,
     W/m²), decided from captured requests: outdoor and indoor
     temperature and humidity, feels like, dew point, wind speed, gust,
     direction and daily peak gust, rain rate, hourly, event, daily,
     weekly, monthly and yearly rain, relative and absolute pressure, UV,
     solar radiation, and battery flags. Unique
     `(station_id, observed_at)`; that pair is also the index.
   - The view `weather_station_readings_30m`: 30-minute averages (sums
     for rain, maxima for gusts) grouped with `date_bin`, tracked in
     Hasura.
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
4. **Ingest listener**: `weather-ingest.conf`, an HTTP server on the
   internal name `weather.internal.ncfritz.net` (the consoles cannot do
   TLS), `allow` for the LAN ranges and `deny all`, proxying the one
   path to the API. The public server blocks that path outright.
5. **Retention**: `@nestjs/schedule`, hourly: delete readings older than
   `WEATHER_STATION_RETENTION_DAYS` in one mutation, logged with the
   count.
6. **Consoles**: each WS-5000's Customized upload set to the ingest
   name, path `/weather/station/report?`, an interval of 60 seconds;
   `docs/guides/weather-stations.md` records the settings and how to
   register a station.
7. **Tests**: parsing from captured requests of both consoles; the
   CIDR and MAC checks; the duplicate; retention.

**Sign-off:** W6, W8.

## Phase 6 — Station views

1. **Operations**: `ListWeatherStations` `GET /weather/stations` (each
   with its latest reading and whether it is reporting, against
   `WEATHER_STATION_STALE_SECONDS`); `ListWeatherStationReadings`
   `GET /weather/station/:stationId/readings?range=24h|7d|30d` (raw for
   24 hours, the 30-minute view otherwise). Both
   `@RequiresIdentity()`: stations are the house's, shared by every
   user.
2. **Site**: the widget's Stations view (`StationsView`, `StationCard`,
   a 24-hour sparkline) refreshed every minute while visible; the page
   `/weather/stations` with the station and range choices, summary
   tiles and the six charts, using the chart library the site already
   has.
3. **Tests**: operations; the not-reporting state; the page's ranges.

**Sign-off:** W7.
