# Weather stations

Connecting an Ambient Weather WS-5000 to Olympus, and checking that it
stays connected ([ADR 0024](../decisions/0024-weather-providers.md),
[the plan](../plans/weather/README.md), phase 5).

A console pushes its readings; nothing polls it. Its **Customized** upload
sends an HTTP GET every ~16 seconds with each reading as a query
parameter and its own MAC address as `PASSKEY`. The console cannot sign in
and cannot do TLS, so it is let in by two things instead:

- **where it is**: the push lands on a port-80 listener only the LAN can
  reach (`infra/docker/nginx/weather-ingest.conf`), and the API accepts it
  only from `WEATHER_STATION_ALLOWED_CIDRS`;
- **what it is**: the MAC has to be a registered station.

Anything else is a 403, logged once an hour per address or MAC, without the
query. Every accepted push is written to the raw archive before it is parsed,
then stored as one row in `weather_station_samples`; a repeat of a stored
reading is ignored.

## 1. DNS

`weather.internal.ncfritz.net` → the Mac Mini's LAN address, in the same
internal zone as the other `*.internal` names. The listener answers only that
name: a console set up with a bare IP address lands on nginx's default server
instead, so use the name.

## 2. Register the station

Registration is an admin's, on the API's OpenAPI page
(`/olympus/api-spec`), signed in:

1. Find the console's MAC: on the WS-5000, **Settings → Wi-Fi → Status**, or
   the router's client list. It is the PASSKEY, so it is the station's
   identity.
2. `CreateWeatherStation`:

   ```json
   {
     "weatherStation": {
       "name": "Mill Creek",
       "macAddress": "A0:B1:C2:D3:E4:F5"
     }
   }
   ```

   Any of `a0:b1:…`, `A0-B1-…` or `a0b1c2d3e4f5` is fine; it is stored upper
   case with colons. A MAC already registered is a 409.

Until this is done every push from the console is a 403, which is also the
quickest way to tell registration from network trouble: a 403 in the API's
log means the push arrived.

## 3. The console

On the WS-5000 (firmware 4.3.8), **Settings → Weather Server → Customized**:

| Setting         | Value                          |
| --------------- | ------------------------------ |
| Enable          | On                             |
| Protocol        | Ambient Weather                |
| Server IP       | `weather.internal.ncfritz.net` |
| Path            | `/weather/station/report?`     |
| Port            | `80`                           |
| Upload interval | the shortest offered (16 s)    |

The path **must end in `?`**. The console appends `&PASSKEY=…&dateutc=…`
straight after it; without the `?` that becomes part of the path, and the
push is a 404 that never reaches the API.

## 4. Check it

Within a minute of saving:

1. **The API log** has no `Refused a station push` line for it.
2. **The archive** has today's file:

   ```sh
   tail -n 1 "$DATA_DIR/weather/archive/A0-B1-C2-D3-E4-F5/$(date -u +%Y/%m/%d).jsonl"
   ```

   Its `remote` should be the console's own address. If it is Docker
   Desktop's instead (`192.168.65.x`, or whatever its VM network is), the
   address check is seeing the Mac's port publishing rather than the
   console, and every push is refused; see _When the address is wrong_.

3. **The samples**, in Hasura's console or with `psql`:

   ```sql
   SELECT observed_at, outdoor_temperature_f, indoor_temperature_f
   FROM olympus.weather_station_samples
   ORDER BY observed_at DESC LIMIT 5;
   ```

   A row every ~16 seconds, `observed_at` in UTC from the console.

4. **The metrics**: `weather_station_reports_total{result="stored"}` rising;
   `refused_address`, `refused_station` and `invalid` flat;
   `weather_archive_operations_total{result="failed"}` at zero.

### When the address is wrong

The allowed ranges are `192.168.15.0/24` and `192.168.0.0/24`
(`WEATHER_STATION_ALLOWED_CIDRS` in `infra/docker/env/prod/olympus-api.env`).
nginx replaces `X-Forwarded-For` with the address it saw, and the API
believes it because nginx is in `TRUSTED_PROXIES`. If what nginx sees is
Docker Desktop's gateway rather than the console, either give nginx's port
80 the host's network so it sees real peers, or — the lesser option — add
that gateway address to the allowed list. The second leaves the LAN-only
listener and the MAC as the whole of the check, and says so in the env
file's comment if it is done.

## 5. A new test fixture

A new console, or new firmware, may send parameters the parser does not know.
Nothing is lost — the archive keeps the query as received — but the fixture
should follow the console:

1. Copy one line's `query` from the archive.
2. Replace the MAC with `A0:B1:C2:D3:E4:F5` and put the fields into
   `ambientPush()` in `apps/api/test/fixtures/olympus.ts`.
3. If a field is new, map it in `stations/ambientReport.ts` (and give it a
   column, by migration) or add it to the ignored names; `unknown` in the
   parser's result lists what it did not recognise.

## The archive

`${DATA_DIR}/weather/archive/<MAC>/<yyyy>/<mm>/<dd>.jsonl`, one line per push
by the UTC day it arrived:

```json
{
  "receivedAt": "2026-09-29T20:00:03.000Z",
  "source": "push",
  "remote": "192.168.15.20",
  "query": "&PASSKEY=…&dateutc=2026-09-29+19:59:44&tempf=58.1…"
}
```

The first push of a new UTC day seals the days before it: `<dd>.jsonl.zst`
beside `<dd>.jsonl.zst.sha256` (`sha256sum -c` format), and the plain file
removed. The `olympus_weather_archive` DAG
([infra/airflow](../../infra/airflow/README.md)) copies sealed days to the
`Weather` share on `nfs01.sea.ncfritz.net` every night, checks them there,
and removes local days older than 30 days once their copy checks.

The archive is the samples' backup: the nightly database dump leaves their
rows out. Replaying it into the tables is phase 6.

## Removing a station

`DeleteWeatherStation` removes it and, by cascade, its samples. Its archive
stays, on disk and on the NAS; registering the same MAC again and replaying
brings the history back.
