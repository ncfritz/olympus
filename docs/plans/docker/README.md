# Docker: stacks, configuration and secrets

The implementation of [ADR 0019](../../decisions/0019-compose-stacks-and-configuration.md),
and the build half of [ADR 0011](../../decisions/0011-centralized-docker-builds.md)
that it depends on. It comes before authentication phase 3, which needs
`hasura-dev` to try its migration on.

| Phase | Delivers                                                                         | Where         | Depends on |
| ----- | -------------------------------------------------------------------------------- | ------------- | ---------- |
| 0     | Close the exposed database, rotate its secrets, restart policies                 | Mac Mini      | —          |
| 1     | Images: monorepo Dockerfiles, `/health`, the bake file, the registry             | repo          | —          |
| 2     | Configuration: `_FILE` secrets, RabbitMQ definitions                             | repo          | 1          |
| 3     | Compose files, `stack.sh`, workspace env files; the laptop stood up from nothing | repo + laptop | 1, 2       |
| 4     | Production cutover, and the home lab's dev database and Hasura                   | Mac Mini      | 3          |
| 5     | The new-host runbook                                                             | docs          | 3          |
| 6     | Backups and the restore drill                                                    | Mac Mini      | 4          |

## The current stack

From the compose and env files on the Mac Mini (2026-09-21). They are
not committed: they name internal hosts, and one unredacted credential
is in them (below).

| Stack      | Services (container name)                                                 | Networks it creates / joins                            | Published          |
| ---------- | ------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| `postgres` | `postgres-server` (`postgres:latest`)                                     | `postgres_net` (+ an unused `prometheus_exporter_net`) | 5432               |
| `hasura`   | `hasura-server` (`hasura/graphql-engine:latest`)                          | `hasura_net`; joins `postgres_postgres_net`            | 8080               |
| `rabbitmq` | `rabbitmq-server` (`ncfritz/rabbitmq:latest`, hostname `snowball`)        | `rabbitmq_net`                                         | 5672, 15672, 15692 |
| `nginx`    | `nginx-server` (`nginx:latest`)                                           | `nginx_net`; joins `olympus_olympus_net`               | 80, 443            |
| `olympus`  | `olympus-site-server`, `olympus-api-server`, `olympus-notification-agent` | `olympus_net`; joins rabbitmq, hasura, grafana         | 3000, 3001         |
| `dionysus` | `dionysus-asset-agents`, `-metadata-agents`, `-search-agents`             | `dionysus_net`; joins olympus, rabbitmq, grafana       | 9229 (metadata)    |

Configuration: none in the compose files for our services. Each image
contains its `production.env` and starts with `--env-file`.

### Findings

Severity is for a LAN-only platform about to be exposed at the border.

| #   | Severity | Finding                                                                                                                                                                                                                                                   | Fixed in      |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | High     | Every image contains its service's `production.env`: AMQP, Hasura, SSH, NZBGet, SMTP and proxy passwords, the TMDB and NZBGeek keys. Anyone with an image has them, and a registry would distribute them. Rotating any of them means rebuilding an image. | 0 (rotate), 1 |
| 2   | High     | Postgres publishes 5432 to the LAN, and the superuser's password is a trivial one written in the compose file.                                                                                                                                            | 0             |
| 3   | High     | Hasura publishes 8080 to the LAN with a trivial admin secret written in the compose file, console and dev mode on: full read and write of every table, around the API and everything in ADR 0018.                                                         | 0             |
| 4   | High     | `postgres:latest` over a bind-mounted data directory: a pull across a major version and the database no longer starts. The schema dump shows the server is 17 or later; the exact major must be read from the container before pinning.                   | 0             |
| 5   | Medium   | The asset agent's env file has the SOCKS proxy username unredacted. It is half of a NordVPN service credential; if these files have been shared anywhere, regenerate the pair.                                                                            | 0             |
| 6   | Medium   | The Olympus and Dionysus services have no `restart:` policy: after a crash or a host restart they stay down.                                                                                                                                              | 0             |
| 7   | Medium   | The metadata agent publishes 9229, Node's inspector port. Harmless while the process doesn't run with `--inspect`, remote code execution if it ever does.                                                                                                 | 0             |
| 8   | Medium   | Every service uses RabbitMQ's `admin` user.                                                                                                                                                                                                               | 2             |
| 9   | Medium   | No log rotation: Docker's `json-file` logs grow without limit (unless the daemon sets it), on top of file logging to bind mounts and Loki.                                                                                                                | 0, 3          |
| 10  | Medium   | The notification agent relays to browsers through the API's Socket.IO gateway, which is on the users listener, accepts any origin and has no authentication: anything that can reach the API can push to every browser. It is not served on `3443`.       | auth plan     |
| 11  | Low      | `container_name` on every service: a second copy (dev) cannot run on the host.                                                                                                                                                                            | 3             |
| 12  | Low      | Stacks join each other's auto-named networks (`olympus_olympus_net`), so they must start in order and depend on project names.                                                                                                                            | 3             |
| 13  | Low      | The API's `DIONYSUS_UPLOAD_PATH` and `DIONYSUS_PUBLISH_PATH` are a macOS path that isn't mounted into the container: uploads land in the container's own layer and vanish when it is recreated. Worth checking whether uploads work today.                | 3             |
| 14  | Low      | Metrics ports differ per agent (3100, 13003, 13007) for no reason; each container has its own network namespace.                                                                                                                                          | 3             |
| 15  | Low      | Leftovers: `version:` keys (ignored by Compose v2), the API's unused `WSS_HOST`, Postgres's unused network.                                                                                                                                               | 3             |

Two things to keep through any change:

- **RabbitMQ's hostname `snowball`.** The broker's data directory is
  named after its node (`rabbit@snowball`); a new hostname starts an
  empty broker next to the old data.
- **Hasura's data source.** Today its connection string, password
  included, is stored in Hasura's metadata. The repository's metadata
  reads it from `HASURA_GRAPHQL_DATABASE_URL` instead, so that variable
  must be set on the engine **before** the repository's metadata is
  applied, or the source disconnects.

## Phase 0 — On the running stack, now

No repository changes; each item is an edit to the files on the Mac
Mini. Node's `--env-file` never overrides a variable already in the
environment, so a value in a compose file's `environment:` wins over the
one baked into an image. Rotations work without rebuilding.

1. Read the versions that are actually running and pin them:
   `docker exec postgres-server postgres --version`, and Hasura's
   `/v1/version`. Replace `latest` with those exact tags.
2. Bind 5432 and 8080 to 127.0.0.1 (`"127.0.0.1:5432:5432"`). Anything
   that reaches them from another machine moves to an SSH tunnel.
3. Rotate the Postgres superuser's password (`ALTER ROLE`; changing
   `POSTGRES_PASSWORD` does nothing to an existing data directory) and
   the `olympus` role's if it is weak.
4. Rotate Hasura's admin secret; set the new one on Hasura and as
   `HASURA_PASSWORD` in the API's `environment:`. Turn off
   `HASURA_GRAPHQL_DEV_MODE` and `HASURA_GRAPHQL_ENABLE_CONSOLE`.
5. `restart: unless-stopped` on the six services without one; remove the
   9229 mapping.
6. Log rotation in Docker's `daemon.json` (`"log-opts": {"max-size":
"10m", "max-file": "5"}`), which covers every container.
7. Since every secret in finding 1 has been inside an image, plan to
   rotate the rest as phase 2 moves them out; the order is in phase 4.

## Phase 1 — Images

1. Dockerfiles for the API and the four agents per ADR 0011:
   `turbo prune <app> --docker`, `pnpm install --frozen-lockfile`, build,
   `pnpm deploy --filter <app> --prod`, then a runtime stage on
   `node:26-alpine` running as `node` with `CMD ["node", "dist/main.js"]`.
   The asset agent keeps ffmpeg and HandBrake. `.dockerignore` excludes
   `*.env`, `node_modules`, `dist` and `infra/dev-ca`.
2. `GET /health` (public, outside the API documents) in
   `@ncfritz/olympus-nest`, beside `/metrics`, for every service.
3. The Hasura image: `v2.39.1.cli-migrations-v3` plus `infra/hasura`'s
   migrations and metadata, and an entrypoint that exports
   `HASURA_GRAPHQL_ADMIN_SECRET`, `HASURA_GRAPHQL_DATABASE_URL` and
   `HASURA_GRAPHQL_METADATA_DATABASE_URL` from their `_FILE`s before
   handing over to the image's own.
4. `infra/docker/docker-bake.hcl`: every image, `linux/arm64` (and
   `linux/amd64` for the asset agent), tagged with the commit; `--load`
   for the laptop.
5. The registry (`registry:2`) on the Mac Mini with an internal-CA
   certificate, as its own small stack.
6. Tests: each image builds, starts, answers `/health`, and has no
   `production.env` in it.

## Phase 2 — Configuration

1. `EnvReader` reads `NAME_FILE` when `NAME` is unset, trimming the
   trailing newline; one unit test per branch. Every service gets it.
2. RabbitMQ definitions: vhosts `/dionysus` and `/dionysus-dev`, one user
   per service and environment with permissions on its vhost only, and
   `admin` kept for the management UI. Loaded at boot from a secret file.
3. The secret list per stack, and what each service reads, in
   `infra/docker/README.md`.

## Phase 3 — Compose files, and the laptop

1. `infra/docker/compose/{data,rabbitmq,nginx,olympus}.yml` per the ADR:
   the `x-service` fragment, networks, published ports, health checks,
   secrets, environment interpolated with `${NAME:?}`. `hasura-dev` is in
   `data.yml` behind a profile that `mac-mini.env` turns on.
2. `infra/docker/env/mac-mini.env` and `laptop.env`, and
   `infra/docker/nginx/olympus.conf` (the Olympus server blocks, which the
   host's nginx includes; its other sites stay the host's).
3. `infra/docker/stack.sh`: `bootstrap` (networks, data and secrets
   directories), `check` (every secret present, `docker compose config`
   clean), `up`, `down`, `pull`, `logs`, per stack.
4. The workspace env files: every service's `dev.env.example` points at
   the Mac Mini's dev endpoints (`hasura-dev`, RabbitMQ as the dev user on
   `/dionysus-dev`); a `local.env.example` points at localhost.
5. The dev CA's API certificate gains `host.docker.internal`, for agents
   in the laptop's containers calling an API run from the IDE.
6. **Stand the laptop up from nothing**: `bootstrap`, the laptop's own
   secrets, a restore of a backup, `data` and `rabbitmq`, then services
   from the IDE and the `olympus` stack from local images. This is the
   rehearsal for a new host, and nothing on the Mac Mini changes for it.
7. `infra/docker/compose/dev.yml` (the workspace-only infra of ADR 0018's
   phase 0) is replaced by `data.yml` with `laptop.env`.

## Phase 4 — Production cutover

One stack at a time, each with its old compose file kept for rollback:

1. **rabbitmq**: same data directory, hostname `snowball`, the image
   pinned by tag, definitions loaded: per-service users, the dev user on
   `/dionysus-dev`; the old `admin` password rotated.
2. **data**: same data directory, the pinned major, production's Hasura
   still on today's image and metadata.
3. **Dev's database and Hasura**: the `olympus_dev` role and database,
   a restore of production into it, then `hasura-dev` on the new image.
   The restore carries the schema, so the baseline migration is marked
   applied first
   (`hasura migrate apply --version 1789862400000 --skip-execution`, per
   `infra/hasura/README.md`). This is the first time the repository's
   metadata is applied anywhere real, on a copy.
4. **Production's Hasura on the new image**: the same two steps, marking
   the baseline and setting `HASURA_GRAPHQL_DATABASE_URL`, against
   production. **This is where the repository's metadata is first applied
   to production**; I'll stop and walk through it with you, with step 3
   as the rehearsal.
5. **olympus**: the new images from the registry, secrets from
   `${SECRETS_DIR}`, each rotated as it moves (finding 1). Prometheus
   scrape targets change to the new names.
6. **nginx**: the Olympus server blocks from the repository.

Done when the old compose files and images can be deleted and every
service answers `/health`.

## Phase 5 — A new host

`docs/guides/new-host.md`: from an empty machine to a running platform
(Docker, the repository, a secrets directory, `bootstrap`, the restore,
`up`), written from the laptop's rehearsal. The NAS deployment follows
with the later Olympus tooling work.

## Phase 6 — Backups

1. Nightly `pg_dump` per database and RabbitMQ's definitions, to the NAS,
   with a retention.
2. The restore drill: `olympus_dev` rebuilt from last night's backup on a
   schedule, so the backups are known to restore; the laptop refreshes
   from the same files.
