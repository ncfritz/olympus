# Airflow

Scheduled work that belongs to Olympus but is not part of any service: the
nightly backups today ([the plan](../../docs/plans/docker/README.md), phase 6),
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

| Requirement                                      | Why                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `/var/run/docker.sock` in the worker             | `DockerOperator`. Without it the work runs in the worker and `pg_dump` comes from Airflow's own image. |
| `apache-airflow-providers-docker` >= 3.0         | `auto_remove` takes `"success"`, not `True`.                                                           |
| The `olympus-data` network reachable             | `postgres` is not published off `127.0.0.1`; containers reach it by name on that network.              |
| The `olympus-backend` network reachable          | RabbitMQ's management port is published only on the host's loopback, so the same applies to it.        |
| This repository readable by the scheduler        | Settings are read from `infra/docker/env/<env>.env`. `OLYMPUS_ROOT` overrides where it looks.          |
| `OLYMPUS_ENV`, if not `prod`                     | Chooses the environment file.                                                                          |
| `OLYMPUS_ALERT_WEBHOOK_FILE`, a path on the host | Where a failure is reported. Unset, failures are logged as errors and nothing is sent.                 |

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

## By hand

```sh
# Once, from the repository, against the Airflow host:
airflow dags test olympus_backup 2026-09-29     # a whole run, no scheduler
airflow tasks test olympus_backup verify 2026-09-29
```

`retain` is the one to read twice before running with a date you care about.
