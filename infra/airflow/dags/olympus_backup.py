"""Nightly database backups for Olympus (docs/plans/docker/README.md, phase 6).

Airflow owns *when*; this repository owns *what*. Every task runs in the same
`postgres:<version>` image the stack itself pins, on the `olympus-data`
network, so `pg_dump` is never older than the server it is dumping. That is the
one version rule this job has to obey, and it obeys it by construction rather
than by anybody remembering to.

Settings are read from `infra/docker/env/<env>.env` in this repository, so they
have one home. Secrets are not read at all: the password file is bind-mounted
into each container by path and the Docker daemon resolves it on the host, so
Airflow never opens it and no copy of it lands in Airflow's database.
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

# What retention keeps. Dailies cover the mistake noticed the next morning;
# the monthlies cover the corruption noticed in April and committed in January.
DAILY, WEEKLY, MONTHLY = 7, 4, 6

NETWORK = "olympus-data"


def settings() -> dict[str, str]:
    """The environment file's KEY=VALUE lines; comments and blanks ignored."""
    values: dict[str, str] = {}
    for line in (REPO / "infra/docker/env" / f"{ENVIRONMENT}.env").read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value.strip()
    return values


ENV = settings()
POSTGRES_IMAGE = f"postgres:{ENV['POSTGRES_VERSION']}"
# compose/data.yml's own default, for an environment that does not set it.
DATABASES = [ENV.get("POSTGRES_DB", "olympus"), "olympus_dev"]

MOUNTS = [
    Mount(source=f"{ENV['DATA_DIR']}/backups", target="/backups", type="bind"),
    Mount(
        source=f"{ENV['SECRETS_DIR']}/postgres_password",
        target="/run/secrets/postgres_password",
        type="bind",
        read_only=True,
    ),
]

# Every script starts here: the day's directory, and the password in the
# environment rather than on a command line, where `ps` would show it.
PREAMBLE = """
DIR=/backups/{{ ds }}
mkdir -p "$DIR"
export PGPASSWORD="$(cat /run/secrets/postgres_password)"
"""


def announce_failure(context: dict[str, Any]) -> None:
    """Says a run failed, and says so loudly when it cannot.

    A backup that stops silently is the failure this job exists to prevent, so
    the absence of somewhere to report to is itself worth an error in the log.
    If this Airflow already has a failure notifier of its own, use that instead
    of this: two notifiers is one more than anybody reads.
    """
    instance = context["task_instance"]
    message = f"olympus_backup: {instance.task_id} failed -- {instance.log_url}"
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
    return DockerOperator(
        task_id=task_id,
        image=POSTGRES_IMAGE,
        network_mode=NETWORK,
        mounts=MOUNTS,
        # DockerOperator otherwise bind-mounts a temporary directory of its own
        # from inside the worker, a path the daemon cannot resolve.
        mount_tmp_dir=False,
        auto_remove="success",
        command=["bash", "-euo", "pipefail", "-c", PREAMBLE + script],
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
    first = step(
        "globals",
        'pg_dumpall -h postgres -U postgres --globals-only > "$DIR/globals.sql"',
    )

    # One at a time rather than in parallel: this runs against the database the
    # platform is using, and there is all night.
    previous = first
    for database in DATABASES:
        # -Fc: compressed, and restorable a table at a time.
        current = step(
            f"dump_{database}",
            f'pg_dump -h postgres -U postgres -Fc -f "$DIR/{database}.dump" {database}',
        )
        previous >> current
        previous = current

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
        """,
    )

    # Last, and only once verify has passed: deleting is the only step here
    # that cannot be undone.
    retain = step(
        "retain",
        f"""
        cd /backups
        ls -1d 20*/ 2>/dev/null | sed 's#/$##' | sort -r > /tmp/all || true
        head -{DAILY} /tmp/all > /tmp/keep
        # Sundays. `date -d` rather than arithmetic: this image has coreutils.
        : > /tmp/weekly
        while read -r day; do
          if [ "$(date -d "$day" +%u 2>/dev/null || echo 0)" = "7" ]; then
            echo "$day" >> /tmp/weekly
          fi
        done < /tmp/all
        head -{WEEKLY} /tmp/weekly >> /tmp/keep
        grep -- '-01$' /tmp/all > /tmp/monthly || true
        head -{MONTHLY} /tmp/monthly >> /tmp/keep
        sort -u /tmp/keep -o /tmp/keep
        sort /tmp/all -o /tmp/all
        comm -23 /tmp/all /tmp/keep > /tmp/drop
        while read -r day; do
          echo "removing $day"
          rm -rf -- "./$day"
        done < /tmp/drop
        echo "kept: $(tr '\\n' ' ' < /tmp/keep)"
        """,
    )

    previous >> verify >> retain
