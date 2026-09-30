# olympus-weather-relay-agent

`@ncfritz/olympus-weather-relay-agent`: prod's weather station pushes, into
a development environment
([ADR 0025](../../docs/decisions/0025-weather-data-in-dev.md)).

The consoles push only to prod. Prod's API publishes every line it writes
to the raw station archive to the `weather.station.reports` exchange on
`/dionysus`; the broker's `weather-relay` shovel carries them to the
exchange of the same name on `/dionysus-dev`. This agent consumes them
from `weather.station.reports.<WEATHER_RELAY_DATABASE>` and sends each to
its environment's `ImportWeatherStationReadings`, which parses it with that
environment's own parser and stores it unless it is already there.

The queue keeps 48 hours of lines (at most 30,000, the oldest dropped) and
disappears a week after nothing reads it. So the relay only needs to run
while you are working: start it and it catches up on the last two days.
Anything older comes from replaying the archive
([the stations guide](../../docs/guides/weather-stations.md), "Weather
data in dev").

It runs in `local` and from the IDE, against a dev API. It has no
production image: prod receives the pushes itself.

## Running it

```sh
cp agents/olympus-weather-relay/dev.env.example agents/olympus-weather-relay/dev.env
# fill in AMQP_PASSWORD; run scripts/dev-ca.sh once for the certificate
pnpm --filter @ncfritz/olympus-weather-relay-agent dev
```

The dev API it calls needs `olympus-weather-relay-agent:agent` in
`AUTH_SERVICE_ROLES` and its services listener on (`TLS_*`).

## Configuration

| Variable                                           | What                                                | Default                    |
| -------------------------------------------------- | --------------------------------------------------- | -------------------------- |
| `WEATHER_RELAY_DATABASE`                           | The database fed; names the queue                   | `olympus_dev`              |
| `API_BASE_URL`                                     | The environment's API, its services listener        | `http://localhost:3100/v1` |
| `API_CLIENT_CERT`, `API_CLIENT_KEY`, `API_CA_CERT` | This agent's certificate, for the services listener | (none)                     |
| `AMQP_*`                                           | The broker, on `/dionysus-dev`                      | `/dionysus-dev`            |
| `LISTEN_PORT`                                      | `/metrics`                                          | `3102`                     |

## What it records

`weather_relay_lines_total{result}`: `stored`, `duplicate`,
`unknown_station` (the environment has not registered that station; after
`refresh-dev` it has prod's), `invalid` (this environment's parser could
not read it), `skipped`, and `failed` (the
API did not answer; the line went back on the queue after a wait of 5
seconds, doubling to a minute).
