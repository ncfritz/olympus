# 0024. Weather: OpenWeather for forecasts, RainViewer for radar, stations pushed locally

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

The home page's weather widget draws a Google map with a Tomorrow.io tile
overlay. Tomorrow.io's free tier is too restrictive to grow into, and the
widget has grown nothing: it fetches no forecast, its four locations are
hard-coded in the component, and until 2026-09-29 its key was in the
source (the roadmap still lists it for rotation).

What the widget should become:

- A current, hourly ("today") and 5-day forecast for one location at a
  time, with a map of weather layers and a global radar layer.
- Locations that each user keeps for themself, found with a place search.
  Changing the location changes every panel. The map's zoom is fixed.
- A separate view of the house's two Ambient Weather WS-5000 stations.

Constraints: free tiers only; Google Maps stays as the base map (the
existing deck.gl overlay on `@vis.gl/react-google-maps`); no provider key
in the browser bundle; local-only where there is a choice (the profile
of the whole platform).

Options considered for forecast data: Open-Meteo (keyless, 10,000
calls/day, non-commercial), OpenWeather, Pirate Weather (10,000 calls a
month), WeatherAPI.com. For tiles: OpenWeather Weather Maps 1.0, the
Open-Meteo map layer (MapLibre/Leaflet/OpenLayers only, so not on Google
Maps), NOAA MRMS radar (US only), RainViewer.

## Decision

### Forecasts: OpenWeather, free plan only

The free plan (60 calls a minute, 1,000,000 a month, no card) and nothing
billed per call. One Call is not used, so there are no government alerts
and no hourly or daily endpoint:

- **Current Weather API** for conditions now.
- **5 day / 3 hour Forecast API** for the rest. "Today" is the next eight
  3-hour steps; the 5-day view is those steps grouped by local day (high,
  low, the most significant condition, the highest chance of
  precipitation). The free plan's data refreshes about every two hours,
  so the widget is no fresher than that.
- **Weather Maps 1.0** for the map layers it offers: temperature,
  precipitation, clouds, pressure, wind.
- **Geocoding API** is not used: places come from Google (below).
- Attribution to OpenWeather is shown on the widget, as its licence
  (ODbL) requires.

### Radar: RainViewer

OpenWeather's free layers are model output, not radar, and its radar is
on the paid Weather Maps 2.0. RainViewer's free Weather Maps API is the
one free global radar: the past two hours in 10-minute frames, personal
use, one colour scheme, **zoom capped at 7** since 2026-01-01, and 100
requests per IP per minute. The widget's map is fixed at zoom 8, so the
radar is drawn from zoom-7 tiles scaled up one level and is a little
coarser than the other layers. Where NOAA radar covers a location (the US) it can be added later
as a sharper layer without changing this decision.

### Places: Google

Location search uses Places Autocomplete (New) through the existing Maps
key, which is already public and restricted by referrer. The Places API
(New) is enabled on that key. A place is stored as its Google place id,
display name and coordinates.

### Everything goes through the API

The site never calls a weather provider. The API (Olympus domain,
`apps/api/src/olympus/weather`):

- holds the OpenWeather key (`OPENWEATHER_API_KEY`, a file secret per
  ADR 0019);
- fetches forecasts and caches them in memory keyed by coordinates
  rounded to two decimal places (about 1 km), so two users with the same
  place share one call;
- proxies map and radar tiles with a cache, so tile traffic is bounded by
  distinct tiles rather than page views, and RainViewer's per-IP limit
  applies to one well-behaved server;
- serves the last good forecast, marked stale, when a provider fails.

The call budget: two calls (current and forecast) per distinct location
every 15 minutes is 192 a day, about 5,800 a month, against a free
allowance of 1,000,000; tiles are the larger share and are cached.

### Locations: a table per user

`weather_locations`: user, label, Google place id, latitude, longitude,
position, and whether it is the user's default. Relational columns only
(ADR 0007), a migration in `infra/hasura/migrations`.

### Stations: pushed over the LAN, archived raw, rolled up in tiers

**Ingest.** The WS-5000 console supports Ambient's **Customized** upload,
an HTTP GET to a server and path of our choosing with the readings as
query parameters and the station's MAC as `PASSKEY`. Both consoles push
to the API on the internal host at the shortest interval they allow
(about every 16 seconds); nothing leaves the house. A station is accepted
only if its MAC is registered, and the endpoint is reachable only on the
LAN. Indoor temperature and humidity arrive in the same push.

**Backfill.** Gaps (an API restart, a deploy) are not critical. The
ambientweather.net REST API (1 request a second per key, history at
5-minute steps) fills them when they are noticed; its keys are file
secrets, and backfilled stretches are sparser than pushed ones.

**Raw archive.** Every push and every backfill response is appended, as
received, to one JSON Lines file per station per day under the API's
data volume, compressed with zstd when the day closes. Finished days are
copied to the NAS (`nfs01.sea.ncfritz.net`, share `Weather`) by Airflow.
The archive is the source of truth: the weather tables can be rebuilt
from it by replay, so they are left out of the database backup. Requests
to Ambient carry its keys and are never archived; only its responses
are.

**Samples.** Each push is parsed into `weather_station_samples`, one row
per push and a column per reading, kept for 48 hours: long enough to roll
up and to re-roll a late correction.

**Rollups.** One row per **station, metric and bucket** in
`weather_station_rollups`, holding the bucket's count, sum, minimum,
maximum, first and last, so every coarser tier is computed exactly from
the one below (an average is sum ÷ count, never an average of averages).
The metrics are rows in `weather_metrics` (name, unit, how it rolls up):
a new sensor is a row, not a migration. The tiers are rows in
`weather_rollup_tiers`:

| Tier | Bucket     | Kept for | Built from |
| ---- | ---------- | -------- | ---------- |
| 1m   | 1 minute   | 7 days   | samples    |
| 5m   | 5 minutes  | 30 days  | 1m         |
| 15m  | 15 minutes | 90 days  | 5m         |
| 30m  | 30 minutes | 180 days | 15m        |
| 1h   | 1 hour     | always   | 30m        |

Wind direction is rolled up as its east–west and north–south components;
rain as the amount fallen since the previous sample (the console's
running totals reset); gusts by their maximum. The rollups and pruning
are SQL functions tracked in Hasura as mutations and called on a schedule
by the API, which stays the only Hasura client; each rewrites its buckets,
so running one again is harmless.

Row per metric keeps within ADR 0007: plain columns, a foreign key to the
metric, no documents in rows. It is about three times the size of a row
per bucket with a column per metric and statistic (about 225 MB once
every tier is full, then 54 MB a year, against 75 MB and 18 MB), a price
worth paying for sensors that arrive without a migration.

## Consequences

- Tomorrow.io is removed: its constant, its env var and its build
  secret. Its key can be revoked rather than rotated.
- The API gains outbound HTTP to three providers and its first cache;
  both need metrics (ADR 0017) and tests with the providers mocked.
- Nothing here is billed: every provider is used on a free plan with no
  payment method on file. Hourly steps are three hours wide and there are
  no alerts; moving to One Call later would be a new record.
- Radar is coarse at the widget's zoom and covers only the past, never a
  forecast.
- The consoles' upload format is not a documented API; parsing it is
  written against captured requests and tested with them.
- Station history is kept for good at an hour's resolution, and finer
  the more recent it is; the tiers are data, so they can change without
  a schema change.
- The raw archive (about 250–370 MB a year compressed) is what makes the
  history recoverable; the NAS copy has to be checked, since nothing else
  backs the weather tables up.
