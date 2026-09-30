"""Nightly database backups for Olympus (docs/plans/docker/README.md, phase 6).

Airflow owns *when*; this repository owns *what*. The database work runs in the
same `postgres:<version>` image the stack itself pins, on the `olympus-data`
network, so `pg_dump` is never older than the server it is dumping. That is the
one version rule this job has to obey, and it obeys it by construction rather
than by anybody remembering to.

Settings are read from `infra/docker/env/<env>.env`, so they have one home --
including the image tags, which is why bumping Postgres there is all it takes.
Secrets are not read at all: a password file is bind-mounted into the container
by path and the Docker daemon resolves it on the host, so Airflow never opens
one and no copy reaches Airflow's database.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.request
from datetime import timedelta
from pathlib import Path
from typing import Any

import pendulum
from airflow.models.dag import DAG
from airflow.providers.docker.operators.docker import DockerOperator
from docker.types import Mount

# The repository root, from this file's place in it, so a checkout anywhere
# works. OLYMPUS_ROOT overrides it for a deployment that syncs only `dags/`.
REPO = Path(os.environ.get("OLYMPUS_ROOT", Path(__file__).resolve().parents[3]))
ENVIRONMENT = os.environ.get("OLYMPUS_ENV", "prod")

# What retention keeps. The dailies cover the mistake noticed the next morning;
# the monthlies cover the corruption noticed in April and committed in January.
DAILY, WEEKLY, MONTHLY = 7, 4, 6

# Tables whose rows come back from somewhere other than this backup.
REBUILT_TABLES = ["olympus.weather_station_samples"]

DATA_NETWORK = "olympus-data"
# RabbitMQ is on another network, and its management port is published only on
# the host's loopback, so a container has to join that network to ask it
# anything.
BROKER_NETWORK = "olympus-backend"


def settings() -> dict[str, str]:
    """The environment file's KEY=VALUE lines; comments and blanks ignored."""
    values: dict[str, str] = {}
    path = REPO / "infra/docker/env" / (ENVIRONMENT + ".env")
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value.strip()
    return values


ENV = settings()
POSTGRES_IMAGE = "postgres:" + ENV["POSTGRES_VERSION"]
HTTP_IMAGE = ENV["BACKUP_HTTP_IMAGE"]
# compose/data.yml's own default, for an environment that does not set it.
DATABASES = [ENV.get("POSTGRES_DB", "olympus"), "olympus_dev"]

BACKUPS = Mount(source=ENV["DATA_DIR"] + "/backups", target="/backups", type="bind")


def secret(name: str) -> Mount:
    """A secret file, mounted where the container will look for it."""
    return Mount(
        source=ENV["SECRETS_DIR"] + "/" + name,
        target="/run/secrets/" + Path(name).name,
        type="bind",
        read_only=True,
    )


# Every script starts here.
PREAMBLE = '\nDIR=/backups/{{ ds }}\nmkdir -p "$DIR"\n'

# The password in the environment rather than on a command line, where `ps`
# would show it.
PGPASSWORD = 'export PGPASSWORD="$(cat /run/secrets/postgres_password)"\n'


def announce_failure(context: dict[str, Any]) -> None:
    """Says a run failed, and says so loudly when it cannot.

    A backup that stops silently is the failure this job exists to prevent, so
    having nowhere to report to is itself worth an error in the log. If this
    Airflow already has a failure notifier of its own, use that instead of this:
    two notifiers is one more than anybody reads.
    """
    instance = context["task_instance"]
    message = "olympus_backup: " + instance.task_id + " failed -- " + instance.log_url
    configured = os.environ.get("OLYMPUS_ALERT_WEBHOOK_FILE")
    if not configured or not Path(configured).exists():
        logging.getLogger(__name__).error(
            "%s -- and no webhook is configured to say so", message
        )
        return
    request = urllib.request.Request(
        Path(configured).read_text().strip(),
        data=json.dumps({"text": message}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10):
        pass


def step(task_id: str, script: str) -> DockerOperator:
    """A task in the image the stack pins, on the database's network."""
    return DockerOperator(
        task_id=task_id,
        image=POSTGRES_IMAGE,
        network_mode=DATA_NETWORK,
        mounts=[BACKUPS, secret("postgres_password")],
        # DockerOperator otherwise bind-mounts a temporary directory of its own
        # from inside the worker, a path the daemon cannot resolve.
        mount_tmp_dir=False,
        auto_remove="success",
        command=["bash", "-euo", "pipefail", "-c", PREAMBLE + PGPASSWORD + script],
    )


with DAG(
    dag_id="olympus_backup",
    description="Olympus's databases, dumped nightly, verified, then pruned",
    # Not on the hour: everything else is.
    schedule="17 2 * * *",
    start_date=pendulum.datetime(2026, 9, 1, tz="America/Los_Angeles"),
    catchup=False,
    max_active_runs=1,
    default_args={
        "retries": 1,
        "retry_delay": timedelta(minutes=10),
        "on_failure_callback": announce_failure,
    },
    tags=["olympus", "backup"],
):
    # Roles live outside every database. Without them a restore onto a fresh
    # host has no `olympus_dev` role to own `olympus_dev`, and nothing says so
    # until that moment.
    previous = step(
        "globals",
        'pg_dumpall -h postgres -U postgres --globals-only > "$DIR/globals.sql"',
    )

    # One at a time rather than in parallel: this runs against the database the
    # platform is using, and there is all night.
    for database in DATABASES:
        # -Fc: compressed, and restorable a table at a time. The weather
        # stations' samples are rebuilt from their raw archive, which
        # olympus_weather_archive copies to the NAS (ADR 0024), so only their
        # table's definition is dumped: a year of readings every ~16 seconds
        # would otherwise be most of every archive, every night.
        current = step(
            "dump_" + database,
            'pg_dump -h postgres -U postgres -Fc -f "$DIR/'
            + database
            + '.dump" '
            + " ".join("--exclude-table-data=" + table for table in REBUILT_TABLES)
            + " "
            + database,
        )
        previous >> current
        previous = current

    # A record rather than something a rebuild needs: the definitions are
    # generated from this repository and each agent declares its own topology at
    # start, so a broker rebuilt from the repository arrives in the same place.
    # What this catches is whatever was made by hand, which the generator does
    # not know about.
    definitions = DockerOperator(
        task_id="rabbitmq_definitions",
        image=HTTP_IMAGE,
        network_mode=BROKER_NETWORK,
        # This image runs as its own unprivileged user; the secret is 0600 and
        # owned by whoever created it.
        user="root",
        mounts=[BACKUPS, secret("rabbitmq/admin.password")],
        mount_tmp_dir=False,
        auto_remove="success",
        # `sh`, not `bash`: this image has busybox. No pipefail either, which is
        # why nothing here is a pipeline.
        command=[
            "sh",
            "-euc",
            PREAMBLE
            + """
            umask 077
            # A config file, so the credentials are never in this container's
            # process list. Unquoted, so a password containing a quote is still
            # read as written.
            printf 'user = admin:%s\\n' "$(cat /run/secrets/admin.password)" > /tmp/curlrc
            # --fail: a 401 or a 404 is a failed task, not a file full of the
            # broker's opinion of us.
            curl --silent --show-error --fail --config /tmp/curlrc \\
              --output "$DIR/rabbitmq-definitions.json" \\
              http://rabbitmq:15672/api/definitions
            """,
        ],
    )

    # Cheap, and it catches a truncated archive on the night it happens rather
    # than on the night it is needed.
    verify = step(
        "verify",
        """
        test -s "$DIR/globals.sql"
        for archive in "$DIR"/*.dump; do
          test -s "$archive"
          pg_restore --list "$archive" > /dev/null
          echo "ok $(basename "$archive"), $(stat -c%s "$archive") bytes"
        done
        # JSON, and an object. --fail should have caught a body that is not,
        # but what matters is the file on disk, not the exit code upstream.
        test -s "$DIR/rabbitmq-definitions.json"
        test "$(head -c1 "$DIR/rabbitmq-definitions.json")" = "{"
        echo "ok rabbitmq-definitions.json"
        """,
    )

    # Last, and only once verify has passed: deleting is the only step here
    # that cannot be undone.
    retain = step(
        "retain",
        """
        cd /backups
        ls -1d 20*/ 2>/dev/null | sed 's#/$##' | sort -r > /tmp/all || true
        head -DAILY_COUNT /tmp/all > /tmp/keep
        # Sundays. `date -d` rather than arithmetic: this image has coreutils.
        : > /tmp/weekly
        while read -r day; do
          if [ "$(date -d "$day" +%u 2>/dev/null || echo 0)" = "7" ]; then
            echo "$day" >> /tmp/weekly
          fi
        done < /tmp/all
        head -WEEKLY_COUNT /tmp/weekly >> /tmp/keep
        grep -- '-01$' /tmp/all > /tmp/monthly || true
        head -MONTHLY_COUNT /tmp/monthly >> /tmp/keep
        sort -u /tmp/keep -o /tmp/keep
        sort /tmp/all -o /tmp/all
        comm -23 /tmp/all /tmp/keep > /tmp/drop
        while read -r day; do
          echo "removing $day"
          rm -rf -- "./$day"
        done < /tmp/drop
        echo "kept: $(tr '\\n' ' ' < /tmp/keep)"
        """.replace("DAILY_COUNT", str(DAILY))
        .replace("WEEKLY_COUNT", str(WEEKLY))
        .replace("MONTHLY_COUNT", str(MONTHLY)),
    )

    previous >> definitions >> verify >> retain
