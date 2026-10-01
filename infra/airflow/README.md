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

The DAGs run their work in containers rather than in the worker, so that
`pg_dump` comes from the same `postgres:<version>` image the stack pins and can
never be older than the server it dumps. That needs:

| Requirement                                                  | Why                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/var/run/docker.sock` in the worker                         | `DockerOperator`. Without it the work runs in the worker and `pg_dump` comes from Airflow's own image.                                      |
| `apache-airflow-providers-docker` >= 3.0                     | `auto_remove` takes `"success"`, not `True`.                                                                                                |
| The `olympus-data` network reachable                         | `postgres` is not published off `127.0.0.1`; containers reach it by name on that network.                                                   |
| The `olympus-backend` network reachable                      | RabbitMQ's management port is published only on the host's loopback, so the same applies to it.                                             |
| This repository readable by the DAG processor and the worker | Both import the DAGs, which read settings from `infra/docker/env/<env>.env`; `OLYMPUS_ROOT` says where the checkout is mounted.             |
| `OLYMPUS_ENV`, if not `prod`                                 | Chooses the environment file.                                                                                                               |
| `OLYMPUS_ALERT_WEBHOOK_FILE`, a path in the worker           | A file holding the webhook URL failures are reported to, mounted into the worker. Unset, failures are logged as errors and nothing is sent. |

Nothing here needs read access to `SECRETS_DIR`. A password file is
bind-mounted into the container by path and the Docker daemon resolves it on the
host, so Airflow never opens one and no copy reaches Airflow's database. Two are
used: `postgres_password` and `rabbitmq/admin.password`.

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
4.6.0): `DAG` comes from `airflow.sdk`, and a run's day is its logical date or,
for a run triggered without one, its `run_after`, since Airflow 3 leaves
`{{ ds }}` undefined then.

## Installing on the Mac Mini

The Mini's Airflow is the Compose project in `~/Docker/compose` (Airflow 3,
CeleryExecutor, its own DAG folder at `~/Docker/data/airflow/airflow/dags`).
Olympus's DAGs are not copied there: the Mini's checkout of this repository is
mounted into the containers, its `infra/airflow/dags` as a subfolder of the DAG
folder, so a `git pull` on the Mini deploys them as it does the nginx
configuration, and the other DAGs stay where they are.

1. **The Docker provider, in the image.** The project builds its own images
   (`airflow-airflow-*`); in its Dockerfile, pinning Airflow so pip cannot
   move it:

   ```dockerfile
   RUN pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" \
       "apache-airflow-providers-docker>=4.6"
   ```

   (`_PIP_ADDITIONAL_REQUIREMENTS` does the same at every start, slowly; it is
   meant for trying things.)

2. **The checkout and the settings, for every Airflow service** (the DAG
   processor parses the DAGs, the worker runs them), in the common block of
   the compose file, with `OLYMPUS_CHECKOUT` the checkout's path on the Mini:

   ```yaml
   environment:
     OLYMPUS_ROOT: /opt/olympus
     OLYMPUS_ENV: prod
   volumes:
     - ${OLYMPUS_CHECKOUT}:/opt/olympus:ro
     - ${OLYMPUS_CHECKOUT}/infra/airflow/dags:/opt/airflow/dags/olympus:ro
   ```

3. **The Docker socket and the webhook, for the worker only** (a service that
   sets its own `volumes:` replaces the common list, so repeat the common
   entries there):

   ```yaml
   airflow-worker:
     environment:
       OLYMPUS_ALERT_WEBHOOK_FILE: /run/secrets/olympus_alert_webhook
     volumes:
       # ...the common entries, then:
       - /var/run/docker.sock:/var/run/docker.sock
       - ~/Docker/secrets/olympus/<webhook file>:/run/secrets/olympus_alert_webhook:ro
   ```

   The image's user is in group `root`, which Docker Desktop's socket allows.

4. `docker compose build && docker compose up -d`, then check, from
   `~/Docker/compose`:

   ```sh
   docker compose exec airflow-worker python -c \
     'import docker; print(docker.from_env().ping())'            # True
   docker compose exec airflow-dag-processor airflow dags list-import-errors
   docker compose exec airflow-worker airflow dags list | grep olympus
   ```

5. **One run of each by hand, in the worker** (it has the socket), before the
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

### `olympus_backup`

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

Into `${DATA_DIR}/backups/<date>/` on the Mac Mini, which is this phase's
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

### `olympus_weather_archive`

Nightly at 03:07, after the backups. The API writes every station push to
`${DATA_DIR}/weather/archive/<MAC>/<yyyy>/<mm>/<dd>.jsonl` and seals each UTC
day as `<dd>.jsonl.zst` with a `sha256sum` file beside it
([ADR 0024](../../docs/decisions/0024-weather-providers.md),
[the guide](../../docs/guides/weather-stations.md)).

- **`copy`** puts every sealed day the NAS does not have yet onto the `Weather`
  share on `WEATHER_NAS_HOST`, under a temporary name until whole, and checks it
  there with `sha256sum -c` against the local checksum. A copy that does not
  check fails the task.
- **`prune`** removes local days older than 30 days, and only those whose NAS
  copy checks; one that does not is logged and kept, and the next `copy` sends
  it again. A day still being written is never touched.

The share is an NFS volume the Docker daemon mounts for the task's container
(`WEATHER_NAS_HOST`, `WEATHER_NAS_EXPORT` in the environment file), so the
worker mounts nothing and holds no credentials. The share's NFS permissions
have to allow the Mac Mini, read/write; Docker Desktop's VM reaches the NAS
through the Mac's address from an unprivileged port, so the rule also needs
"Allow connections from non-privileged ports".

## By hand

In the worker (`docker compose exec airflow-worker ...` on the Mini):

```sh
airflow dags test olympus_backup                # a whole run, today, no scheduler
airflow tasks test olympus_backup verify 2026-09-29
airflow tasks test olympus_weather_archive copy 2026-09-29
```

`retain` is the one to read twice before running with a date you care about.
