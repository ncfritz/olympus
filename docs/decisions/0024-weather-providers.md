# 0024. Weather: OpenWeather for forecasts, RainViewer for radar, stations pushed locally

- **Status:** Proposed
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

### Forecasts: OpenWeather

- **One Call API 4.0** for current conditions, hourly, daily and
  government alerts, on its free allowance of 1,000 calls a day (billed
  per call beyond it). The account's daily call limit is set to 1,000 in
  the OpenWeather console so the allowance cannot turn into a bill.
- **Weather Maps 1.0** (free: 60 calls a minute, 1,000,000 a month) for
  the map layers it offers: temperature, precipitation, clouds, pressure,
  wind.
- **Geocoding API** is not used: places come from Google (below).
- Attribution to OpenWeather is shown on the widget, as its licence
  (ODbL) requires.

### Radar: RainViewer

OpenWeather's free layers are model output, not radar, and its radar is
on the paid Weather Maps 2.0. RainViewer's free Weather Maps API is the
one free global radar: the past two hours in 10-minute frames, personal
use, one colour scheme, **zoom capped at 7** since 2026-01-01, and 100
requests per IP per minute. At the widget's fixed zoom the radar tiles
are drawn from zoom 7 and scaled up, so radar is coarser than the other
layers. Where NOAA radar covers a location (the US) it can be added later
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

The call budget: one forecast refresh per distinct location every 30
minutes is 48 calls a day, so the 1,000-call allowance covers about 20
distinct locations across all users.

### Locations: a table per user

`weather_locations`: user, label, Google place id, latitude, longitude,
position, and whether it is the user's default. Relational columns only
(ADR 0007), a migration in `infra/hasura/migrations`.

### Stations: pushed over the LAN

The WS-5000 console supports Ambient's **Customized** upload, an HTTP GET
to a server and path of our choosing with the readings as query
parameters and the station's MAC as `PASSKEY`. Both consoles push to the
API on the internal host; nothing leaves the house. A station is
accepted only if its MAC is registered, and the endpoint is reachable
only on the LAN. The ambientweather.net cloud API (1 request a second
per key) stays available as a fallback and is not used by default.

## Consequences

- Tomorrow.io is removed: its constant, its env var and its build
  secret. Its key can be revoked rather than rotated.
- The API gains outbound HTTP to three providers and its first cache;
  both need metrics (ADR 0017) and tests with the providers mocked.
- One Call is the only thing here that can cost money; the console cap
  is what keeps it at zero and has to be set before the key is used.
- Radar is coarse at the widget's zoom and covers only the past, never a
  forecast.
- The consoles' upload format is not a documented API; parsing it is
  written against captured requests and tested with them.
- Open questions for the design and plan: how much station history to
  keep, the forecast refresh interval, and whether alerts appear in the
  widget.
