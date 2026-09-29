# Weather: functional sign-off

One test plan per flow of [ADR 0024](../../decisions/0024-weather-providers.md)
and the [design](design.md), used to sign off each phase of the
[plan](README.md). Automated tests cover the logic; these checks prove
the flows on the real pieces: the providers, the consoles, the site.

## Environments

| Id       | Where                                                              | Used from |
| -------- | ------------------------------------------------------------------ | --------- |
| **DEV**  | the API and site from the workspace against `hasura-dev`           | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack, the ingest listener, both consoles | phase 4   |

## Fixtures

| Fixture       | What                                                         |
| ------------- | ------------------------------------------------------------ |
| `user-a`      | a signed-in user with the four existing locations            |
| `user-b`      | a second signed-in user with none                            |
| `station-a/b` | the two WS-5000 consoles, registered                         |
| `bad-key`     | the API started with an invalid `OPENWEATHER_API_KEY`        |
| `no-egress`   | the API with provider hosts unreachable (a blocked DNS name) |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

## W1 — Locations

1. `user-a` adds a place by search; it is last, labelled with Google's
   name, and relabelling it sticks after a reload.
2. Reorder, set a default, delete: the menu follows, and the widget opens
   on the default.
3. `user-b` sees none of `user-a`'s locations; `user-a`'s ids answer 404
   for `user-b`.
4. With no identity every location operation answers 401.

## W2 — Forecast

1. For each of the four locations the widget's now, next 24 hours and
   5 days match OpenWeather's own responses for the coordinate (fetched
   by hand).
2. Bath and Kona group their days at their own midnight, not Pacific.
3. Switching location changes every panel and recentres the map.
4. Two requests within the TTL make one provider call
   (`http_client_request_duration_seconds_count{server="openweather"}`
   rises by two: current and forecast).

## W3 — Provider failure

1. `no-egress` after a good fetch: the widget shows the last forecast
   with the stale banner and its time; the API logs the failure once.
2. Past the maximum stale age: the error state; the rest of the page
   works.
3. `bad-key`: the same, and the log names a key problem without the key.
4. Egress restored: fresh data within one refresh, banner gone.

## W4 — Map layers

1. Each layer draws over the Google map at zoom 8; switching is
   immediate for tiles already seen.
2. The browser's network log shows only `/api/v1/…` tile requests; the
   built bundle contains no OpenWeather key (`grep` of `.next`).
3. A second page load draws from the browser cache; a cold API cache
   fills and then serves hits (`weather_cache_requests_total`).

## W5 — Radar

1. Radar is the default layer; the scrubber covers the past two hours;
   play loops the frames.
2. Tiles above zoom 7 are refused by the API; the widget shows zoom-7
   tiles scaled.
3. RainViewer unreachable: the note over the base map; forecasts
   unaffected.

## W6 — Station push

1. Both consoles report; readings arrive about once a minute with
   `observed_at` from the console.
2. A request with an unregistered MAC is 403 and stores nothing.
3. The report path from outside the LAN (a phone on mobile data, and the
   public host name) is refused by nginx.
4. A repeated request stores one row.

## W7 — Station views

1. The Stations view shows both stations' latest readings, matching the
   consoles' displays.
2. Unplugging one console: "not reporting" after 10 minutes, with the
   time of its last reading.
3. The history page's 24 h, 7 d and 30 d ranges; 7 and 30 days plot
   30-minute averages, and the rain chart's daily totals match the
   console.

## W8 — Retention

1. With retention set to 1 day in DEV, the hourly job removes older rows
   and logs the count.
2. Raising it keeps rows longer with no schema change.

## W9 — Tomorrow.io removed

1. No reference to Tomorrow.io in the repository or the built bundle.
2. The key is revoked at Tomorrow.io; the roadmap item is closed.
