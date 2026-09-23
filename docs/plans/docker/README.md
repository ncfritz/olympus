# Docker: stacks, configuration and secrets

The implementation of [ADR 0019](../../decisions/0019-compose-stacks-and-configuration.md),
and the build half of [ADR 0011](../../decisions/0011-centralized-docker-builds.md)
that it depends on. It comes before authentication phase 3, which needs
`hasura-dev` to try its migration on.

| Phase | Delivers                                                                        | Where        | Depends on |
| ----- | ------------------------------------------------------------------------------- | ------------ | ---------- |
| 0     | Close the exposed database, rotate its secrets, restart policies (**done**)     | Mac Mini     | —          |
| 1     | Images: monorepo Dockerfiles, `/health`, the bake file, the registry (**done**) | repo         | —          |
| 2     | Configuration: `_FILE` secrets, RabbitMQ definitions (**done**)                 | repo         | 1          |
| 3     | Compose files, `stack.sh`, workspace env files; local stood up from nothing     | repo + local | 1, 2       |
| 4     | Production cutover, and the home lab's dev database and Hasura                  | Mac Mini     | 3          |
| 5     | The new-host runbook; the NAS                                                   | docs, NAS    | 3          |
| 6     | Backups and the restore drill                                                   | Mac Mini     | 4          |

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
| 16  | Low      | The RabbitMQ image downloads its delayed-message plugin unverified, and that plugin is no longer maintained: it can't run on RabbitMQ 4.3, and every `x-delay` retry depends on it.                                                                       | 1, roadmap    |

Two things to keep through any change:

- **RabbitMQ's hostname `snowball`.** The broker's data directory is
  named after its node (`rabbit@snowball`); a new hostname starts an
  empty broker next to the old data.
- **Hasura's data source.** Today its connection string, password
  included, is stored in Hasura's metadata. The repository's metadata
  reads it from `HASURA_GRAPHQL_DATABASE_URL` instead, so that variable
  must be set on the engine **before** the repository's metadata is
  applied, or the source disconnects.

## Phase 0 — On the running stack (done 2026-09-21)

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
5. Tag the RabbitMQ image you build instead of `latest`, at the version
   it was built from.
6. `restart: unless-stopped` on the six services without one; remove the
   9229 mapping.
7. Log rotation in Docker's `daemon.json` (`"log-opts": {"max-size":
"10m", "max-file": "5"}`), which covers every container.
8. Since every secret in finding 1 has been inside an image, plan to
   rotate the rest as phase 2 moves them out; the order is in phase 4.

## Phase 1 — Images (done 2026-09-22)

Written 2026-09-21 and first built on the Mac Mini on 2026-09-22 (the
workspace these were written in can't reach an image registry). Each step
of `node/Dockerfile` (prune, frozen install, build, production deploy)
was rehearsed outside Docker for all five services, with every module
their bundles require resolving and both native modules loading.

1. `infra/docker/node/Dockerfile`, one for the API and the four agents:
   prune, install and build on the build platform, `pnpm deploy --prod`
   on the image's platform (native modules), runtime on `node:26-alpine`
   as `node`, `HEALTHCHECK` on `/health`, `CMD ["node", "dist/main.js"]`.
   `/.dockerignore` keeps env files, keys and local data out of the
   context. The per-app Dockerfiles are gone. **Written.**
   - Found on the way: the API declared six runtime packages
     (`@nestjs/core`, `@nestjs/platform-socket.io`, `class-validator`,
     `class-transformer`, `reflect-metadata`, `rxjs`) as dev-only, which
     npm's flat install had hidden; they are dependencies now. Each app
     has a `files` list, so an image carries its build and not its
     sources.
2. `GET /health` in `@ncfritz/olympus-nest`, public on the API.
   **Done.**
3. The Hasura image, and its entrypoint turning `_FILE` secrets into
   Hasura's variables (5 tests). **Written.**
4. The RabbitMQ image (**done 2026-09-21**), now loading the definitions.
5. `/docker-bake.hcl` (at the root, where `bake` looks for it): every image, the asset agent for
   `linux/amd64` too; checked with `bake --print`. **Written.**
6. The registry, `registry.internal.ncfritz.net`: `compose/registry.yml`
   (`registry:3`, plain HTTP on `olympus-edge`, its own login) behind the
   shared nginx (`nginx/registry.conf`, TLS). Pushes go through an
   `olympus` BuildKit builder, since the default one can't build two
   platforms. **Done 2026-09-22**: every image pushed, anonymous access
   refused, the asset agent listed for arm64 and amd64.
7. The first builds on the Mac Mini: `bake --load` for the API, the
   services and Hasura and RabbitMQ all succeed (**done 2026-09-22**).
8. The Minerva agent and console move to phase 3, which is the first to
   need them (the `olympus` stack): the agent's Prisma CLI must be a
   runtime dependency to run migrations at start, and the console needs
   Next.js's `standalone` output.

## Phase 2 — Configuration (done 2026-09-21)

1. `EnvReader` reads `NAME_FILE` when `NAME` is unset, trimming the
   trailing newline; one unit test per branch. Every service gets it.
   Setting both `NAME` and `NAME_FILE`, or naming a file that can't be
   read, is a problem reported at boot.
2. RabbitMQ definitions: vhosts `/dionysus` and `/dionysus-dev`, one user
   per service and environment with permissions on its vhost only, and
   `admin` kept for the management UI. Loaded at boot from a secret file.
   `infra/docker/rabbitmq/users.json` lists them;
   `definitions.mjs` hashes each user's password file into the
   definitions (checked against RabbitMQ's published example), and the
   image's `conf.d` loads them.
3. The secret list per stack, and what each service reads, in
   `infra/docker/README.md`.

## Phase 3 — Compose files, and local (done 2026-09-23)

1. The Minerva agent and console images: the agent through the shared
   Node Dockerfile with Prisma generated on the image's platform and
   `prisma` a runtime dependency; the console through
   `infra/docker/next/Dockerfile` (`standalone`), calling the agent at
   `/api` on `minerva.internal.ncfritz.net`. **Done.**
2. `compose/{data,hasura-dev,rabbitmq,nginx,olympus}.yml`: fixed network
   names, secrets, pinned images, health checks, log rotation, `init`, no
   capabilities, limits on the asset agent; the site's current image
   behind a `site` profile and Minerva behind `minerva`, its migrations a
   one-shot service the agent waits for. `hasura-dev` became a stack of
   its own rather than a profile of `data`. **Done**, checked with a
   Compose dry run on both hosts' settings.
3. `env/prod.env`, `env/local.env` and `env/<env>/<service>.env`,
   the Mac Mini's from its production env files without their secrets.
   **Done.** Found on the way: file logging couldn't be turned off in
   production (fixed), the search agent's `EVENTS_DIRECTORY` and
   `PERSIST_EVENTS` and the asset agent's `DISABLE_TEST_HANDLER` were
   never read (dropped), the API's upload directory is now a volume the
   asset agent shares, and every service listens on 3100 (Minerva 4432).
4. `stack.sh`: `bootstrap`, `check`, `up`, `down`, `rabbitmq-users` and
   passthroughs; bash 3.2, shellcheck-clean. **Done.**
5. Every service's `dev.env.example` points at the home lab's dev
   endpoints (`olympus.dev.ncfritz.net`: hasura-dev on 8081,
   RabbitMQ as `olympus-dev` on `/dionysus-dev`), and a
   `local.env.example` at local's own. **Done.**
6. The dev CA's API certificate names `host.docker.internal`.
   **Done** (`scripts/dev-ca.sh --force` to regenerate).
7. `infra/docker/nginx/olympus.conf`: today's Olympus server block with
   the new service names (the site, the API under `/api` with its path
   passed on still encoded, the explorers, `/api/metrics`, Socket.IO), and
   `minerva.internal.ncfritz.net` with its agent under `/api`. Services
   are found through Docker's DNS, so nginx starts with any of them down.
   The Minerva server block is short-lived: [ADR 0021](../../decisions/0021-control-host-and-console-navigation.md)
   replaces it with the control host ([plan](../console/README.md)).
   Two changes: the API gets `X-Forwarded-Prefix: /api`, so its Location
   headers carry `/api`, and the cipher list is nginx's default (the old
   one allowed 3DES). `/api/metrics` pointed at the dev API; it points at
   the API now. **Done**, checked by running it in front of stand-in
   backends.
8. **Stand local up from nothing**: `bootstrap local`, its own
   secrets, `rabbitmq-users`, a restore of a backup, images with
   `bake --load`, then `stack.sh up`. This is the rehearsal for a new
   host, and nothing on the Mac Mini changes for it.

   **Done.** Three things it found, which is the point of doing it on a
   second machine:

   - Nothing created the `olympus` database Hasura's URL names: prod's
     data directory predates the compose files.
   - The images were sensitive to the build context's file modes.
     `pnpm deploy` copies a workspace dependency out of the context and
     keeps its mode, and the runtime drops to `node`, so a file at 0600
     was unreadable. A checkout from git is 0644, so prod could not have
     shown it.
   - `packages/sdk` shipped without its `dist`: no `files` field, so
     packing fell back to the package's own .gitignore, which excludes
     it. The API is the one service that depends on neither the SDK nor
     the client, which is why it was healthy while all four agents
     restarted.

   The last two are now checked rather than remembered: the chmod is in
   the Dockerfile that produces the tree, and
   `packages/config/test/unit/packaging.spec.ts` holds every workspace
   package to shipping what its entry points resolve to.

9. `compose/dev.yml` is gone; `data.yml` with `env/local.env` replaces
   it. **Done.**

## Phase 4 — Production cutover

What the Mac Mini actually looked like on 2026-09-23, which is why this
is shorter than it was drafted to be:

- Postgres's data directory is **major 16**, so `POSTGRES_VERSION=16.3`
  stands. Phase 0 could only guess at this from a schema dump.
- **No agent is running.** The old `dionysus` project is down and so is
  the notification agent; the only pre-monorepo containers left are
  `olympus-api-server` and `olympus-site-server`. There is no second set
  of consumers to race, so the agents are a start rather than a swap.
- **RabbitMQ has one user, `admin`, and nothing queued.** The new
  definitions are a first load, not a migration, and nothing drains.
- `${SECRETS_DIR}` already holds the third-party credentials, the RabbitMQ
  definitions and a password per user. Missing: `postgres_password`,
  `hasura_admin_secret`, `hasura_database_url`, and the `hasura_dev` pair.

Rotation is split: what we own both ends of (Postgres, the Hasura admin
secret, every RabbitMQ user) rotates as it moves; the third-party
credentials — TMDB, NZBGeek, NZBGet, the SSH passwords, SMTP, the SOCKS
proxy — are a separate pass, since each needs changing at the other end
too. A maintenance window is fine: the API and site stop while their
containers are replaced.

### 0. Before the window

1. `infra/docker/stack.sh bootstrap prod`. The environment rename moved
   the marker to `env/.current`, so `stack.sh` refuses until this runs.
2. Confirm the paths the old compose files bind-mount are the ones
   `prod.env` names: `${DATA_DIR}/postgres` and `${DATA_DIR}/rabbitmq/data`.
   A mismatch here is a stack that starts on an empty directory.
3. Pin `POSTGRES_VERSION` to the exact minor now running
   (`docker exec postgres-server postgres --version`), not just the major.
4. Build and push every image at one commit, and set `OLYMPUS_TAG`,
   `HASURA_TAG`, `HASURA_DEV_TAG` and `RABBITMQ_TAG` to it. On the Mac
   Mini that is `--load`, not `--push` (see `infra/docker/README.md`).
5. **Take the rollback**: `pg_dump` the `olympus` database, and
   `hasura metadata export` from the running engine into a directory
   outside the repository. The metadata apply in step 3 is the one step
   that cannot be undone by starting the old container again.

### 1. rabbitmq

Nothing is consuming and nothing is queued, so this is independent of
everything else. Stop the old project, `stack.sh up rabbitmq`, and check
`rabbitmqctl list_users` shows the nine and `list_vhosts` both vhosts.
The definitions rotate `admin` as they load.

### 2. The dev database, and the metadata rehearsal

Production is untouched by this whole step; it exists so that step 3 has
already been done once.

1. In the **old** Postgres: the `olympus_dev` role and database, then
   `pg_dump olympus | psql olympus_dev`.
2. Write `hasura_dev_admin_secret`, and `hasura_dev_database_url` pointing
   at `host.docker.internal:5432` for now — the new `data` network does
   not exist yet.
3. The restore carries the schema, so the baseline must be recorded as
   applied before our image starts, or it will try to create what is
   already there. `hdb_catalog.schema_migrations` does not exist until
   migrations have run, so the row cannot simply be inserted: it is the
   CLI against a plain `hasura/graphql-engine:v2.39.1`,
   `hasura migrate apply --database-name olympus --version 1789862400000
--skip-execution`, then stop it.

   Before starting any engine, check what the copied metadata says the
   source connects to. Production's holds a **literal** connection
   string, so an engine on the copy would connect its source to
   production; rewrite it to `from_env` in the copy first, which is what
   the repository's metadata says anyway. That rewrite is also what the
   apply does to production in step 3, so `HASURA_GRAPHQL_DATABASE_URL`
   has to be right before the swap, not after.

4. `stack.sh up hasura-dev`, then `hasura metadata apply`. Compare what
   the engine reports against the repository, and run
   `hasura metadata export` once to commit whatever the CLI normalises.

### 3. data — and the metadata apply (**stop here and walk through it**)

The window opens.

1. Stop `olympus-api-server` and `olympus-site-server`, so nothing is
   querying Hasura while it moves.
2. Rotate the password of **the role Hasura connects as**, which the
   rehearsal showed is `olympus`, not the superuser:
   `ALTER ROLE olympus PASSWORD …` on the running server.
   `POSTGRES_PASSWORD_FILE` only applies to an empty data directory, so
   `postgres_password` is for tools rather than the server. Write
   `hasura_database_url` as
   `postgres://olympus:<new>@postgres:5432/olympus` and
   `hasura_admin_secret` with a new value. Use hex: a password with
   `:`, `@`, `/`, `+` or `=` in it needs percent-encoding inside a
   connection string, and silently authenticates as something else if it
   doesn't get it.
3. Mark the baseline applied on production's `olympus` database. No
   throwaway engine is needed here, unlike the copy: production's engine
   is already running and its `olympus` source is already its own
   database, so the CLI points at it directly. Do this **before**
   rotating the role's password, while that engine can still connect.
4. Stop the old `postgres` and `hasura` projects; `stack.sh up data`.
   Our image applies the repository's metadata on start. **This is the
   first time it touches production.**
5. Verify: `/healthz`, a known query through the API's usual path, and
   row counts against what the rollback dump says.

### 4. olympus

`stack.sh up olympus` recreates the API and the site from the new
definitions — Compose already counts `olympus-api-server` and
`olympus-site-server` as this file's `olympus-api` and `olympus-site` —
and starts the notification agent, the three Dionysus agents, and the
control index and Minerva that are already there. Prometheus's scrape
targets change to the new container names.

### 5. nginx

The repository's server blocks; the host's own copies go: the old Olympus
block, the file with its `upstream` blocks — a name in one that does not
resolve is what stops nginx starting — and the registry block copied in
phase 1. `control.conf` is already in place from the console plan.

### 6. Afterwards

Repoint `hasura_dev_database_url` at `postgres:5432` on the `data`
network and restart `hasura-dev`. Done when the old compose files and
images can be deleted and every service answers `/health`.

## Phase 5 — A new host, and the NAS

1. `docs/guides/new-host.md`: from an empty machine to a running
   platform (Docker, the repository, a secrets directory, `bootstrap`,
   the restore, `up`), written from local's rehearsal.
2. The NAS: `compose/nas.yml`, one container running the asset agent's
   `amd64` image, and `env/nas.env` choosing its handlers. Its own
   certificate (`OU=nas`) and RabbitMQ user; the NAS's Docker trusts the
   registry's internal-CA certificate.

## Phase 6 — Backups

1. Nightly `pg_dump` per database and RabbitMQ's definitions, to the NAS,
   with a retention.
2. The restore drill: `olympus_dev` rebuilt from last night's backup on a
   schedule, so the backups are known to restore; local refreshes
   from the same files.
