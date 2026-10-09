# 0025. Weather data reaches dev by replay for history and a relay for live pushes

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

[ADR 0024](0024-weather-providers.md) has the WS-5000 consoles push to
prod's API, which archives each push raw and stores it. A console has one
Customized upload target, so every push lands in prod and nowhere else.
Dev ([ADR 0022](0022-environments-not-machines.md): the `olympus_dev`
database, the `/dionysus-dev` vhost and `hasura-dev`, used by `local` and
by services run from the IDE) gets no station data at all. The station
views, the rollups and the parser are all built against dev, so it needs
realistic data, both recent and historical.

Three things shape the answer:

- **Dev often has no history.** `refresh-dev` restores `olympus_dev` from
  the nightly backup, which leaves out the samples' rows (the archive is
  their backup). A laptop's own database starts empty. A dev machine
  that was off for a week has a week-long hole.
- **Nothing in dev runs all the time.** There is no always-on dev API.
  Whatever writes live data into dev runs while someone is developing.
- **Dev changes the code that reads the data.** A parser fix or a new
  column is developed in dev before prod has it. Dev should read what
  the console sent, not prod's interpretation of it.

Options considered: nginx `mirror` of each push to a dev API (simple,
lossy, the Mac Mini's dev only); dev pulling parsed samples from prod's
API (self-healing, but dev gets prod's parser output, and dev reaches
into prod); Postgres logical replication of the samples table between the
two databases on the one server (no code, but it makes dev's table a
replica that dev's own migrations would break); replay of the raw archive
alone (full history, but up to a day behind); and a RabbitMQ relay of
each push.

## Decision

**History by replay, live pushes by relay, both carrying the raw archive
line and both parsed by the receiving environment's own code.**

### One unit: the archive line

What prod archives is what dev receives. Every line
`StationArchive` writes (a push's query as received, or a backfill
response) is also published, with the station's MAC, as a
`WeatherArchiveLine` message. Replay reads the same lines from the day
files. So an environment ingests weather in exactly one way: an archive
line in, parsed by its own parser, stored with the idempotent insert
(unique `(station_id, observed_at)`, a repeat ignored). Push, relay and
replay all end there. Replay also has a mode that replaces existing rows,
for after a parser fix; the relay never replaces.

Lines are published after they are archived and before they are parsed,
so dev also receives pushes that prod's parser rejected. A publish that
fails is logged and counted, and never fails the push. Publishing is
off unless `WEATHER_RELAY_PUBLISH=true`, which only prod sets, so a test
push to a dev API cannot feed the relay.

### History: replay from the archive

Phase 6's replay (`weather:replay`, `ReplayWeatherArchive`) takes a
source directory and a target environment. Dev's sources are the NAS
copy (sealed days, everything) or, on the Mac Mini, prod's archive
directory itself (the last 30 days, including today's unsealed file).
After `refresh-dev`, or on a new laptop, one replay with `--since` brings
dev up to date. Stations are in the backup, so dev knows prod's MACs
without registering them again.

### Live: a relay through RabbitMQ

- **Prod** publishes to a fanout exchange, `weather.station.reports`,
  on `/dionysus`. Prod has no consumer of its own: its write stays in the
  push request, and the archive is its buffer.
- **A shovel** (the `rabbitmq_shovel` plugin, declared in the broker's
  definitions) moves everything from that exchange to an exchange of the
  same name on `/dionysus-dev`. Queues cannot be bound across vhosts; a
  shovel is RabbitMQ's answer to that, and it keeps prod from knowing dev
  exists. The definitions file is already a secret, so the shovel's URIs
  can carry the credentials of a user limited to those two vhosts.
- **One queue per target database** on `/dionysus-dev`, declared by the
  consumer: `weather.station.reports.<database>`. Consumers writing to
  the same database share its queue (each line delivered once); a laptop
  with a database of its own declares its own queue and gets its own
  copy. Every such queue has `x-message-ttl` of 48 hours, `x-max-length`
  of 30,000 with the oldest dropped, and `x-expires` of 7 days, so a
  queue nobody reads costs about 30 MB at most and disappears after a
  week.
- **`agents/olympus-weather-relay`** consumes that queue and sends lines
  in batches to `ImportWeatherStationReadings` on the dev API, over the
  services listener as `agent`. Like every agent, it talks to the
  platform only through the SDK; the API stays the only Hasura client.
  The import skips a MAC the environment does not know, does no address
  check (the line was checked where it was received) and writes no
  archive (it came from one).

### Why 48 hours joins the two up

A UTC day is sealed at its first push of the next day and reaches the
NAS at the next 03:07 Pacific, at most about 34 hours after its first
line. A queue that holds 48 hours therefore always overlaps what replay
can read, so a dev that replays up to the newest sealed day and then
starts the relay has no gap. The overlap is harmless: the insert ignores
repeats.

### Backfill stays in prod

Only prod asks ambientweather.net for gaps (phase 7). Its responses are
archive lines, so dev receives them through the relay and replay like
any push. `WEATHER_BACKFILL_ENABLED` is off outside prod: two
environments filling the same gap would spend the same key twice and
disagree about the result.

## Consequences

- Dev has prod's history on demand and prod's pushes while the relay
  runs, parsed by dev's own code, which is what a parser or schema
  change needs to be developed against.
- Dev's weather data is not guaranteed to be complete. A relay that has
  not run for more than 48 hours leaves a gap until the next replay.
  That is accepted: replay is one command.
- Prod gains a publish on the push path and a flag to turn it on, and
  nothing else. If the broker is down, prod's ingest is unaffected.
- The broker gains the shovel plugin, a user and a shovel in its
  definitions (`infra/docker/rabbitmq`), and two exchanges. Its
  definitions test grows to cover them.
- A new agent, a new service operation, a message in
  `packages/messages`, and `WEATHER_RELAY_PUBLISH`,
  `WEATHER_RELAY_QUEUE` and `WEATHER_BACKFILL_ENABLED` settings.
- Phase 6's replay becomes the shared ingest path rather than a recovery
  tool, so it is designed with dev as a target from the start.
- Revisit this if dev becomes an environment with always-on services
  (ADR 0022): the relay agent would then run all the time and the TTL
  could shrink.
