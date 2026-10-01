# Airflow

Scheduled work that belongs to Olympus but is not part of any service: the
nightly backups ([the plan](../../docs/plans/docker/README.md), phase 6) and
the weather archive's copy to the NAS,
more later. Airflow decides **when**; what runs is here, reviewed like the rest
of the repository and deployed the same way the host's other DAGs are, from
git.

Airflow itself is not part of this repository. It is a stack of its own on the
Mac Mini, with jobs of its own, and that makes it a prerequisite rather than a
component: a new host built from
[new-host.md](../../docs/guides/new-host.md) comes up with a platform and no
schedule until Airflow is there too. Keeping the DAGs here is what keeps the
_what_ in the repository.

Python beside a TypeScript monorepo: nothing here is in `pnpm`'s workspace or
turbo's graph, and neither prettier nor ESLint reads it — which also means
nothing in the workspace checks it.

## What a DAG here needs from the host

`olympus_backup` runs its work in containers rather than in the worker, so
that `pg_dump` comes from the same `postgres:<version>` image the stack pins
and can never be older than the server it dumps. `olympus_weather_archive`
runs in the worker and reaches the NAS over SFTP, as the host's other DAGs do.
Between them they need:

| Requirement                                                         | Why                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/var/run/docker.sock` in the worker                                | `DockerOperator`. Without it the work runs in the worker and `pg_dump` comes from Airflow's own image.                                      |
| `apache-airflow-providers-docker` >= 3.0                            | `auto_remove` takes `"success"`, not `True`.                                                                                                |
| `apache-airflow-providers-sftp`                                     | The archive's copy: `SFTPHook` on the connection named by `WEATHER_NAS_SFTP_CONNECTION`.                                                    |
| That SFTP connection                                                | `olympus_weather_sftp`: the NAS, as the `weather` user, whose password lives in the connection.                                             |
| The archive in the worker, read/write, at `OLYMPUS_WEATHER_ARCHIVE` | `${DATA_DIR}/weather/archive`; `prune` deletes the days it has copied.                                                                      |
| The `olympus-data` network reachable                                | `postgres` is not published off `127.0.0.1`; containers reach it by name on that network.                                                   |
| The `olympus-backend` network reachable                             | RabbitMQ's management port is published only on the host's loopback, so the same applies to it.                                             |
| This repository readable by the DAG processor and the worker        | Both import the DAGs, which read settings from `infra/docker/env/<env>.env`; `OLYMPUS_ROOT` says where the checkout is mounted.             |
| `OLYMPUS_ENV`, if not `prod`                                        | Chooses the environment file.                                                                                                               |
| `OLYMPUS_ALERT_WEBHOOK_FILE`, a path in the worker                  | A file holding the webhook URL failures are reported to, mounted into the worker. Unset, failures are logged as errors and nothing is sent. |

The backups need no read access to `SECRETS_DIR`. A password file is
bind-mounted into the container by path and the Docker daemon resolves it on
the host, so Airflow never opens one and no copy reaches Airflow's database. Two
are used: `postgres_password` and `rabbitmq/admin.password`. The archive's NAS
password is the exception, by choice: it is an Airflow connection, like the
host's other SFTP jobs.

Image tags come from the environment file like every other version in this
platform — `POSTGRES_VERSION` for the database work, and `BACKUP_HTTP_IMAGE` for
the one task needing an HTTP client, since the postgres image has none. That
second one is a small public image, and the tag in `prod.env` is worth checking
against what you want pinned: it was written from a session that could not reach
Docker Hub.

Three settings that are easy to get wrong: `mount_tmp_dir=False` is required,
because `DockerOperator` otherwise bind-mounts a temporary directory from inside
the worker, which the daemon cannot resolve; `network_mode` takes the network's
real name (`olympus-data`), not Compose's service alias; and the HTTP task runs
as `root`, because that image's own user cannot read a `0600` secret owned by
somebody else.

Written for Airflow 3 (tried on 3.3.0 with `apache-airflow-providers-docker`
4.6.0 and `apache-airflow-providers-sftp` 6.1.0): `DAG` comes from `airflow.sdk`, and a run's day is its logical date or,
for a run triggered without one, its `run_after`, since Airflow 3 leaves
`{{ ds }}` undefined then.

## Installing on the Mac Mini

The Mini's Airflow is the Compose project `airflow` in `~/Docker/compose`
(Airflow 3, CeleryExecutor), built from `~/Docker/dockerfiles/airflow`, with
its own DAG folder at `~/Docker/data/airflow/airflow/dags`. Olympus's DAGs are
not copied there: the Mini's checkout of this repository is mounted into the
two services that read them, its `infra/airflow/dags` as a subfolder of the
DAG folder, so a `git pull` on the Mini deploys them as it does the nginx
configuration, and the other DAGs stay where they are.

1. **The image.** In the Dockerfile, pin the base (`latest` moves the next
   time it is built, and these DAGs were tried on 3.3.0), and add the Docker
   provider with Airflow pinned so pip cannot move it:

   ```dockerfile
   FROM apache/airflow:3.3.0
   # ...
   RUN pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" \
       "apache-airflow-providers-docker>=4.6" "apache-airflow-providers-sftp>=6.1"
   ```

2. **The checkout's path**, in `~/Docker/compose/.env`:
   `OLYMPUS_CHECKOUT=<the checkout on the Mini>`.

3. **The DAG processor and the worker** (one parses the DAGs, the other runs
   them) get the checkout and the settings. Only those two: `airflow-init`
   chowns everything under `/opt/airflow`, which a read-only mount refuses. A
   service that sets its own `volumes:` replaces the common list, so each
   repeats it:

   ```yaml
   environment:
     <<: *airflow-common-env
     OLYMPUS_ROOT: /opt/olympus
     OLYMPUS_ENV: prod
   volumes:
     - /Users/ncfritz/Docker/data/airflow/airflow/dags:/opt/airflow/dags
     - /Users/ncfritz/Docker/data/airflow/airflow/logs:/opt/airflow/logs
     - /Users/ncfritz/Docker/data/airflow/airflow/config:/opt/airflow/config
     - /Users/ncfritz/Docker/data/airflow/airflow/plugins:/opt/airflow/plugins
     - ${OLYMPUS_CHECKOUT:?}:/opt/olympus:ro
     - ${OLYMPUS_CHECKOUT:?}/infra/airflow/dags:/opt/airflow/dags/olympus:ro
   ```

   The worker also gets the Docker socket, the archive (read/write: `prune`
   deletes what it has copied) and, if there is one, the alert webhook:

   ```yaml
     OLYMPUS_WEATHER_ARCHIVE: /opt/olympus-weather-archive
     OLYMPUS_ALERT_WEBHOOK_FILE: /run/secrets/olympus_alert_webhook
     # ...
     - /var/run/docker.sock:/var/run/docker.sock
     - /Users/ncfritz/Docker/data/weather/archive:/opt/olympus-weather-archive
     - /Users/ncfritz/Docker/secrets/olympus/<webhook file>:/run/secrets/olympus_alert_webhook:ro
   ```

   The image's user is in group `root` (`user: 50000:0`), which Docker
   Desktop's socket allows.

4. **The NAS and the connection.** On `nfs01`: a `weather` user with
   read/write on the `Weather` share and SFTP allowed (Control Panel >
   Application Privileges). In Airflow (Admin > Connections), connection
   `olympus_weather_sftp`: type SFTP, host `nfs01.sea.ncfritz.net`, login
   `weather`, its password, and the port and host-key settings your other
   SFTP connections use. The share is `/Weather` to that user
   (`WEATHER_NAS_SFTP_DIR`).

5. `docker compose build && docker compose up -d`, then check, from
   `~/Docker/compose`:

   ```sh
   docker compose exec airflow-worker python -c \
     'import docker; print(docker.from_env().ping())'            # True
   docker compose exec airflow-dag-processor airflow dags list-import-errors
   docker compose exec airflow-worker airflow dags list | grep olympus
   ```

6. **One run of each by hand, in the worker** (it has the socket), before the
   schedule. New DAGs arrive paused (`DAGS_ARE_PAUSED_AT_CREATION`):

   ```sh
   docker compose exec airflow-worker airflow dags test olympus_weather_archive
   docker compose exec airflow-worker airflow dags test olympus_backup
   docker compose exec airflow-worker airflow dags unpause olympus_weather_archive
   docker compose exec airflow-worker airflow dags unpause olympus_backup
   ```

   The archive's `copy` has nothing to send until a UTC day has been sealed
   (the first push after midnight UTC seals the day before).

## The DAGs

### `olympus_backup` (Olympus Backup)

Nightly at 02:17. `globals` → a `pg_dump -Fc` per database →
`rabbitmq_definitions` → `verify` → `retain`, in that order and one at a time —
it runs against the database the platform is using, and there is all night.

- **`globals`** is `pg_dumpall --globals-only`. Roles live outside every
  database; without them a restore onto a fresh host has no `olympus_dev` role
  to own `olympus_dev`, and nothing says so until that moment.
- **`rabbitmq_definitions`** pulls `/api/definitions` from the management API
  as `admin`. It is a record rather than something a rebuild needs — the
  definitions are generated from this repository and each agent declares its own
  exchanges and queues at start — so what it captures is whatever was made by
  hand, which the generator does not know about. The credentials go into a curl
  config file rather than onto the command line, so they are never in that
  container's process list.
- **`verify`** runs `pg_restore --list` over each archive, and checks the
  definitions are on disk and are JSON. It catches a truncated archive on the
  night it happens rather than on the night it is needed.
- **`retain`** keeps 7 daily, the 4 most recent Sundays and 6 first-of-months,
  and runs last because deleting is the only step here that cannot be undone.
  Directories that are not dated, and loose files, are left alone.

Into `${BACKUP_DIR}/<date>/` on the Mac Mini (`/Users/ncfritz/Docker/data/olympus/backups`;
`stack.sh bootstrap` creates it, and Docker will not mount a missing folder), which is this phase's
honest limit: it survives a bad migration, a dropped table and a botched
metadata apply. It does not survive a dead Mac Mini. Getting the archives off
the host is later work.

Restoring one is `stack.sh refresh-dev`, by hand, which is also what proves the
archives restore — run it before a schema change, and not less than monthly.

The weather stations' samples and rollups are dumped as definitions without
rows (`REBUILT_TABLES`): they are rebuilt from the raw archive below, and a
year of readings every ~16 seconds would otherwise be most of every dump. A
restore brings the tables back empty; `weather:replay` fills them
([the guide](../../docs/guides/weather-stations.md)).

### `olympus_weather_archive` (Olympus Weather Archive)

Nightly at 03:07, after the backups. The API writes every station push to
`${DATA_DIR}/weather/archive/<MAC>/<yyyy>/<mm>/<dd>.jsonl` and seals each UTC
day as `<dd>.jsonl.zst` with a `sha256sum` file beside it
([ADR 0024](../../docs/decisions/0024-weather-providers.md),
[the guide](../../docs/guides/weather-stations.md)).

- **`copy`** puts every sealed day the NAS does not have yet onto the `Weather`
  share over SFTP, under a temporary name until whole, then reads the copy
  back and compares its SHA-256 with the local checksum file (SFTP runs no
  commands on the NAS; a day is small). A local day that does not match its own
  checksum file, or a copy that does not check, fails the task, after the
  other days have been tried.
- **`prune`** removes local days older than 30 days, and only those whose NAS
  copy checks the same way; one that does not is logged and kept, and the next
  `copy` sends it again. A day still being written is never touched.

Both run in the worker with `SFTPHook` on `WEATHER_NAS_SFTP_CONNECTION`, into
`WEATHER_NAS_SFTP_DIR` (`prod.env`), the way the host's other SFTP jobs reach
the NAS.

## By hand

In the worker (`docker compose exec airflow-worker ...` on the Mini):

```sh
airflow dags test olympus_backup                # a whole run, today, no scheduler
airflow tasks test olympus_backup verify 2026-09-29
airflow tasks test olympus_weather_archive copy 2026-09-29
```

`retain` is the one to read twice before running with a date you care about.

## Tests

The weather archive's copy and prune have tests against a fake SFTP client, in
a virtualenv with Airflow 3 and the SFTP provider (nothing in the workspace runs
them):

```sh
python -m venv .venv && . .venv/bin/activate
pip install "apache-airflow==3.3.0" apache-airflow-providers-sftp pytest
python -m pytest infra/airflow/tests
```
