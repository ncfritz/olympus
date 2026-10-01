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

| Fixture       | What                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| `user-a`      | a signed-in user with the four existing locations                                            |
| `user-b`      | a second signed-in user with none                                                            |
| `station-a/b` | the two WS-5000 consoles, registered (b once its site's firewall lets it reach the listener) |
| `bad-key`     | the API started with an invalid `OPENWEATHER_API_KEY`                                        |
| `no-egress`   | the API with provider hosts unreachable (a blocked DNS name)                                 |

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
5. Today keeps its whole day: the high and low (5 days, and Now's) seen
   in the evening are no narrower than the morning's, and today's rows in
   `weather_forecast_steps` include steps that have passed.
6. Next 24 hours: Temp, Feels like, Humidity and Pressure each draw the
   curve with the values OpenWeather's forecast gives for those steps.

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

1. The first console reports at its shortest interval; samples arrive
   with `observed_at` from the console, and indoor readings with them.
   The archive's `remote` for its pushes is Docker Desktop's gateway,
   `192.168.65.1` (the guide, _Where pushes come from_). The second
   console, once its site's firewall allows it, repeats this.
2. A request with an unregistered MAC is 403 and stores nothing.
3. The report path from outside the LAN (a phone on mobile data, and the
   public host name, with and without a trailing slash) is refused: 404
   from nginx on the public name, 403 from the API for any other way in.
4. A repeated request stores one row.
5. The router is the address check: from another host on the IoT
   network, the listener (`weather.internal.ncfritz.net:80`) cannot be
   reached; from the console's reserved address it can.

## W7 — Rollups

1. For one hour of real samples, the 1m buckets' count, average,
   minimum and maximum match the samples computed by hand (a SQL query
   over `weather_station_samples`).
2. The 5m, 15m, 30m and 1h buckets for that hour match the same
   statistics computed directly from the samples. Both by
   [`checks/w7-rollups.sql`](checks/w7-rollups.sql).
3. Rain over a midnight reset, and wind from either side of north, come
   out right.
4. Stopping the API for ten minutes: after it starts the tiers catch up
   with no duplicate or missing buckets beyond the gap.

## W8 — Retention

1. With the tiers' retention shortened in DEV, pruning removes each
   tier's old rows and the samples after 48 hours, and logs the counts.
2. Restoring the retention takes effect without a migration.

## W9 — Tomorrow.io removed

1. No reference to Tomorrow.io in the repository or the built bundle.
2. The key is revoked at Tomorrow.io; the roadmap item is closed.

## W10 — Raw archive

1. Every push appears as one line in the day's file, in order, with the
   query as received.
2. At the day's end the file is compressed and its SHA-256 recorded.
3. The nightly copy puts it on `nfs01.sea.ncfritz.net` (`Weather`); the
   checksum matches; local days are removed only after 30 days and a good
   copy.
4. No archive line contains an Ambient API key.
5. The database backup holds the weather schema and no station sample
   or rollup rows (the forecast history's rows may be there: they are
   two days of forecasts, harmless either way).

## W11 — Backfill

1. Stopping ingest for an hour (the listener down), then restoring it:
   the gap fills from ambientweather.net within an hour, at 5-minute
   steps, marked `backfill`, and the responses are archived.
2. No pushed sample is replaced.
3. No archive line and no log line contains either Ambient key.
4. `BackfillWeatherStations` for a week before the first push: the 1h
   tier covers it, and the daily rain totals match ambientweather.net's.
5. Dev, with the relay running, receives the backfill lines and stores
   them too.

## W12 — Station views

1. The Stations view shows both stations' latest readings, matching the
   consoles' displays.
2. Unplugging one console: "not reporting" after 10 minutes, with the
   time of its last reading.
3. _(Once the history page is built.)_ The history page: each preset and a custom range pick the expected
   resolution; an override to a finer tier works where one covers the
   range; the rain chart's daily totals match the console.
4. _(Once the history page is built.)_ Replay: drop the weather rows in
   DEV, replay the archive, and the history page shows the same charts as
   before.
5. Registering: an admin's Stations tab offers Register station (and
   Register a station when there are none); a MAC in any of its forms is
   accepted and shows at once; a MAC already registered is refused in the
   modal; a user without `admin` sees neither.

## W13 — Weather data in dev

1. After `refresh-dev`, one replay from the NAS copy fills `olympus_dev`
   up to the newest sealed day; the history page in dev matches prod's
   for that range.
2. Starting the relay agent against the dev API: dev's latest sample is
   within a minute of prod's, and stays there.
3. Stopping the relay for an hour, then starting it: the hour arrives
   from the queue, with no gap and no duplicate rows.
4. A line prod's parser rejected arrives in dev and is counted invalid
   there too; with a parser change in dev, it is stored.
5. Stopping RabbitMQ: prod's pushes are still stored and archived, and
   the publish failures are counted.
6. `/dionysus-dev`'s relay queue stays under its length limit with no
   consumer for three days, and a laptop's own queue disappears a week
   after its last use.

## Runs

### Run 1 — started 2026-10-01

Environment PROD unless a case says otherwise; build `994621e2` for the
repository checks (the deployed tag is recorded per case). Ran by Neil,
with Claude for the repository and log checks.

| Case  | Result   | Evidence                                                                                                                                                                                                                                                                                                 |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W9.1  | partial  | Repository: no reference to Tomorrow.io outside the roadmap item W9.2 closes, this plan and ADR 0024 (`git grep -i tomorrow`). A local site build (`.next`, 2026-10-01): none. The production image's build is still to grep.                                                                            |
| W4.2  | partial  | The same local build: no `appid=` key and no OpenWeather URL but the attribution link. The production image's build is still to grep.                                                                                                                                                                    |
| W6.1  | pass (a) | `station-a` (E8:DB:84:E6:49:FD): samples every 16 s, `observed_at` from the console's `dateutc`, `received_at` within a second, `source` push, outdoor and indoor readings (2026-10-01 07:05–07:06 UTC). The archive's `remote` is `192.168.65.1`. `station-b` waits on its site's firewall.             |
| W6.2  | pass     | `PASSKEY=00:00:00:00:00:01` answered 403. The API refuses an unregistered MAC before archiving or storing (StationReportService; unit-tested).                                                                                                                                                           |
| W6.3  | pass     | Neil: from a phone on mobile data, the public name refused the report path, with and without a trailing slash.                                                                                                                                                                                           |
| W6.4  | pass     | The newest archive line's query sent again answered 200; `(station_id, observed_at)` is unique, so it was counted a duplicate rather than stored twice.                                                                                                                                                  |
| W6.5  | pass     | Neil: another host on the IoT network cannot reach the listener; the console can.                                                                                                                                                                                                                        |
| W10.1 | pass     | Neil: the day's archive lines match the pushes, in order, the query as received.                                                                                                                                                                                                                         |
| W10.4 | pass     | `grep -F -f` of each Ambient key over the whole archive: 0 lines for `ambient_api_key`, 0 for `ambient_application_key`.                                                                                                                                                                                 |
| W10.5 | pass     | `olympus_backup` run by hand 2026-10-01 into `BACKUP_DIR`: `pg_restore --list olympus.dump` has `weather_station_samples` and `weather_station_rollups` as TABLE, CONSTRAINT, INDEX and FK CONSTRAINT entries and no TABLE DATA for either (the samples' sequence value is kept).                        |
| W7.1  | pass     | `checks/w7-rollups.sql` for 2026-10-01 17:00–18:00 UTC, outdoor temperature: the 1m tier's 60 buckets match the samples' count, sum, minimum and maximum; missing 0, differ 0.                                                                                                                           |
| W7.2  | pass     | The same run: 5m (12 buckets), 15m (4), 30m (2) and 1h (1) each match the samples directly; missing 0, differ 0.                                                                                                                                                                                         |
| W12.1 | pass (a) | Neil: the Stations tab matches `station-a`'s console. `station-b` to follow.                                                                                                                                                                                                                             |
| W12.5 | pass     | Neil: an admin registers from the tab (both buttons), a repeated MAC is refused in the modal, a non-admin sees neither.                                                                                                                                                                                  |
| W13.2 | pass     | Neil, 2026-10-01 12:55 PDT: with the shovel running (RabbitMQ `248976e9`) and the relay on the laptop against the dev API, `station-a` reports in dev and its readings match prod's. Needed `cdad42d4`: agents sent `<name>-development` as the client header outside production, which the API refused. |
