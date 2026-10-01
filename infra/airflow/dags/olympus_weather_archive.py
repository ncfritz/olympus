"""The weather stations' raw archive, copied to the NAS nightly (ADR 0024).

The API writes every push to `${DATA_DIR}/weather/archive` and seals each UTC
day as `<dd>.jsonl.zst` beside a `sha256sum` file once the next day starts
(apps/api/src/olympus/weather/stations/StationArchive.ts). The archive is the
source of truth the samples and rollups can be rebuilt from, which is why the
weather tables' rows are left out of the database backup: this copy is their
backup.

`copy` puts every sealed day on the NAS that is not there yet, and checks it
there with `sha256sum -c`. `prune` then removes local days older than
KEEP_DAYS, and only those whose NAS copy checks: a day that never made it
stays until it does. A day still being written (a plain `.jsonl`) is never
touched.

Like olympus_backup, the work runs in a container: the NAS share is an NFS
volume the Docker daemon mounts, so Airflow's worker needs no mount of its own
and no credentials.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.sdk import DAG
from airflow.providers.docker.operators.docker import DockerOperator
from docker.types import DriverConfig, Mount

REPO = Path(os.environ.get("OLYMPUS_ROOT", Path(__file__).resolve().parents[3]))
ENVIRONMENT = os.environ.get("OLYMPUS_ENV", "prod")

# How long a day stays on the Mac Mini once it is safely on the NAS: long
# enough to replay a recent month without touching the NAS.
KEEP_DAYS = 30

# The run's day, as YYYY-MM-DD (UTC). Not `{{ ds }}`: Airflow 3 leaves it
# undefined for a run triggered without a logical date, so a backup run by
# hand would fail to render. Such a run still has `run_after`.
DAY = "{{ (logical_date or dag_run.run_after).strftime('%Y-%m-%d') }}"


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
# Any image with bash and coreutils; this one is already pulled for the
# backups, and its tag has one home.
IMAGE = "postgres:" + ENV["POSTGRES_VERSION"]

ARCHIVE = Mount(
    source=ENV["DATA_DIR"] + "/weather/archive", target="/archive", type="bind"
)

# The NAS share as an NFS volume. The daemon mounts it when the container
# starts and lets go when it stops; nothing on the host is mounted for good.
NAS = Mount(
    source="olympus-weather-nas",
    target="/nas",
    type="volume",
    driver_config=DriverConfig(
        name="local",
        options={
            "type": "nfs",
            "o": "addr=" + ENV["WEATHER_NAS_HOST"] + ",rw,nfsvers=4",
            "device": ":" + ENV["WEATHER_NAS_EXPORT"],
        },
    ),
)


def step(task_id: str, script: str) -> DockerOperator:
    return DockerOperator(
        task_id=task_id,
        image=IMAGE,
        mounts=[ARCHIVE, NAS],
        # See olympus_backup: the worker's own temporary directory is a path
        # the daemon cannot resolve.
        mount_tmp_dir=False,
        auto_remove="success",
        command=["bash", "-euo", "pipefail", "-c", script],
    )


# Every sealed day under /archive: <MAC>/<yyyy>/<mm>/<dd>.jsonl.zst.sha256,
# one per line, oldest first. `find` rather than a glob, so no day is
# missed however many stations there are.
SEALED = "find /archive -name '*.jsonl.zst.sha256' | sort"

# True when the NAS has this day, whole. The checksum file is the local
# one, so a copy the NAS has mangled does not vouch for itself.
ON_NAS = """
on_nas() {
  local sum="$1" rel base
  rel="${sum#/archive/}"; rel="${rel%/*}"
  base="$(basename "$sum" .sha256)"
  [ -f "/nas/$rel/$base" ] || return 1
  (cd "/nas/$rel" && sha256sum --check --status "$sum")
}
"""

with DAG(
    dag_id="olympus_weather_archive",
    description="The weather stations' sealed days, copied to the NAS and checked",
    # After the backups. The API seals a UTC day at the first push of the
    # next, which is late afternoon here, so yesterday's is always ready.
    schedule="7 3 * * *",
    start_date=pendulum.datetime(2026, 10, 1, tz="America/Los_Angeles"),
    catchup=False,
    max_active_runs=1,
    default_args={"retries": 1, "retry_delay": timedelta(minutes=10)},
    tags=["olympus", "weather"],
):
    copy = step(
        "copy",
        ON_NAS
        + SEALED
        + """ > /tmp/sealed
        copied=0; present=0
        while read -r sum; do
          if on_nas "$sum"; then present=$((present + 1)); continue; fi
          rel="${sum#/archive/}"; rel="${rel%/*}"
          base="$(basename "$sum" .sha256)"
          mkdir -p "/nas/$rel"
          # Under a temporary name until whole, as the API does locally.
          cp "/archive/$rel/$base" "/nas/$rel/$base.partial"
          mv "/nas/$rel/$base.partial" "/nas/$rel/$base"
          cp "$sum" "/nas/$rel/$base.sha256"
          on_nas "$sum" || { echo "copy of $rel/$base does not check" >&2; exit 1; }
          echo "copied $rel/$base"
          copied=$((copied + 1))
        done < /tmp/sealed
        echo "copied $copied, already there $present"
        """,
    )

    prune = step(
        "prune",
        ON_NAS
        + 'cutoff="$(date -d "' + DAY + ' - '
        + str(KEEP_DAYS)
        + ' days" +%Y-%m-%d)"\n'
        + SEALED
        + """ > /tmp/sealed
        removed=0
        while read -r sum; do
          rel="${sum#/archive/}"
          # <MAC>/<yyyy>/<mm>/<dd>.jsonl.zst.sha256 -> yyyy-mm-dd
          IFS=/ read -r _mac year month file <<< "$rel"
          day="$year-$month-${file%%.*}"
          [[ "$day" < "$cutoff" ]] || continue
          if on_nas "$sum"; then
            rm -- "${sum%.sha256}" "$sum"
            removed=$((removed + 1))
          else
            echo "keeping ${rel%.sha256}: its NAS copy does not check" >&2
          fi
        done < /tmp/sealed
        echo "removed $removed days older than $cutoff"
        """,
    )

    copy >> prune
