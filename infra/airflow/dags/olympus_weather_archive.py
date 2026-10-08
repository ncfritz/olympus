"""The weather stations' raw archive, copied to the NAS nightly (ADR 0024).

The API writes every push to `${DATA_DIR}/olympus/apps/api/weather/archive` and seals each UTC
day as `<dd>.jsonl.zst` beside a `sha256sum` file once the next day starts
(apps/api/src/olympus/weather/stations/StationArchive.ts). The archive is the
source of truth the samples and rollups can be rebuilt from, which is why the
weather tables' rows are left out of the database backup: this copy is their
backup.

`copy` puts every sealed day on the NAS that is not there yet, over SFTP, under
a temporary name until whole, and checks it there: the copy is read back and
its SHA-256 compared with the local checksum file (SFTP runs no commands on the
NAS, and a day is small). `prune` then removes local days older than
KEEP_DAYS, and only those whose NAS copy checks the same way: a day that never
made it stays until it does. A day still being written (a plain `.jsonl`) is
never touched.

Unlike olympus_backup, the work runs in the worker: the NAS is reached the way
the host's other DAGs reach it, through an Airflow SFTP connection
(WEATHER_NAS_SFTP_CONNECTION, the `weather` user), and the archive is mounted
into the worker at OLYMPUS_WEATHER_ARCHIVE (infra/airflow/README.md).
"""

from __future__ import annotations

import errno
import hashlib
import io
import logging
import os
import posixpath
import re
from datetime import date, timedelta
from pathlib import Path
from typing import IO, Protocol

import pendulum
from airflow.sdk import DAG, get_current_context, task

REPO = Path(os.environ.get("OLYMPUS_ROOT", Path(__file__).resolve().parents[3]))
ENVIRONMENT = os.environ.get("OLYMPUS_ENV", "prod")

# The archive, as the worker sees it.
ARCHIVE = Path(os.environ.get("OLYMPUS_WEATHER_ARCHIVE", "/opt/olympus-weather-archive"))

# How long a day stays on the Mac Mini once it is safely on the NAS: long
# enough to replay a recent month without touching the NAS.
KEEP_DAYS = 30

# <MAC>/<yyyy>/<mm>/<dd>.jsonl.zst, the MAC with dashes.
SEALED_DAY = re.compile(
    r"^(?P<mac>[0-9A-F]{2}(?:-[0-9A-F]{2}){5})/(?P<year>\d{4})/(?P<month>\d{2})/(?P<day>\d{2})\.jsonl\.zst$"
)

log = logging.getLogger(__name__)


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
CONNECTION = ENV["WEATHER_NAS_SFTP_CONNECTION"]
REMOTE_ROOT = ENV["WEATHER_NAS_SFTP_DIR"]


class Sftp(Protocol):
    """What these tasks use of paramiko's SFTPClient."""

    def open(self, filename: str, mode: str = "r") -> IO[bytes]: ...
    def putfo(self, fl: IO[bytes], remotepath: str) -> object: ...
    def rename(self, oldpath: str, newpath: str) -> None: ...
    def remove(self, path: str) -> None: ...
    def mkdir(self, path: str) -> None: ...
    def stat(self, path: str) -> object: ...


class CopyFailed(Exception):
    """A day's NAS copy does not match its checksum."""


def sealed_days(root: Path) -> list[str]:
    """Every sealed day under the archive, relative and oldest first."""
    days = []
    for path in root.rglob("*.jsonl.zst"):
        relative = path.relative_to(root).as_posix()
        if SEALED_DAY.match(relative) and path.with_name(path.name + ".sha256").exists():
            days.append(relative)
    return sorted(days, key=lambda rel: (day_of(rel), rel))


def day_of(relative: str) -> date:
    match = SEALED_DAY.match(relative)
    if not match:
        raise ValueError(relative + " is not a sealed day")
    return date(int(match["year"]), int(match["month"]), int(match["day"]))


def expected_sum(root: Path, relative: str) -> str:
    """The day's SHA-256, from the checksum file the API wrote beside it."""
    return (root / (relative + ".sha256")).read_text().split()[0].lower()


def sha256_of(stream: IO[bytes]) -> str:
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1 << 16), b""):
        digest.update(chunk)
    return digest.hexdigest()


def remote_sum(sftp: Sftp, path: str) -> str | None:
    """The SHA-256 of a file on the NAS, read back; None when it is not there."""
    try:
        with sftp.open(path, "rb") as remote:
            return sha256_of(remote)
    except OSError as error:
        if error.errno == errno.ENOENT or isinstance(error, FileNotFoundError):
            return None
        raise


def makedirs(sftp: Sftp, path: str) -> None:
    """mkdir -p, one level at a time; SFTP has no recursive mkdir."""
    parts = [part for part in path.split("/") if part]
    current = "/" if path.startswith("/") else ""
    for part in parts:
        current = posixpath.join(current, part) if current else part
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def remove_quietly(sftp: Sftp, path: str) -> None:
    try:
        sftp.remove(path)
    except OSError:
        pass


def copy_day(sftp: Sftp, root: Path, remote_root: str, relative: str) -> bool:
    """Puts one day on the NAS unless it is there whole; True when it copied."""
    want = expected_sum(root, relative)
    local = root / relative
    with local.open("rb") as stream:
        if sha256_of(stream) != want:
            raise CopyFailed(relative + " does not match its own checksum file")

    remote = posixpath.join(remote_root, relative)
    if remote_sum(sftp, remote) == want:
        return False

    makedirs(sftp, posixpath.dirname(remote))
    partial = remote + ".partial"
    with local.open("rb") as stream:
        sftp.putfo(stream, partial)
    # SFTP's rename will not replace a file; a copy there that did not check
    # goes first.
    remove_quietly(sftp, remote)
    sftp.rename(partial, remote)
    if remote_sum(sftp, remote) != want:
        raise CopyFailed("the NAS copy of " + relative + " does not check")
    sum_text = (root / (relative + ".sha256")).read_bytes()
    remove_quietly(sftp, remote + ".sha256")
    sftp.putfo(io.BytesIO(sum_text), remote + ".sha256")
    return True


def copy_all(sftp: Sftp, root: Path, remote_root: str) -> tuple[int, int]:
    """Every sealed day the NAS does not have whole: (copied, already there)."""
    copied = present = 0
    failed = []
    for relative in sealed_days(root):
        try:
            if copy_day(sftp, root, remote_root, relative):
                copied += 1
                log.info("copied %s", relative)
            else:
                present += 1
        except CopyFailed as error:
            log.error("%s", error)
            failed.append(relative)
    log.info("copied %d, already there %d", copied, present)
    if failed:
        raise CopyFailed(str(len(failed)) + " days did not copy: " + ", ".join(failed))
    return copied, present


def prune_all(sftp: Sftp, root: Path, remote_root: str, today: date, keep_days: int) -> int:
    """Local days older than keep_days whose NAS copy checks, removed."""
    cutoff = today - timedelta(days=keep_days)
    removed = 0
    for relative in sealed_days(root):
        if day_of(relative) >= cutoff:
            continue
        if remote_sum(sftp, posixpath.join(remote_root, relative)) == expected_sum(root, relative):
            (root / relative).unlink()
            (root / (relative + ".sha256")).unlink()
            removed += 1
        else:
            log.warning("keeping %s: its NAS copy does not check", relative)
    log.info("removed %d days older than %s", removed, cutoff.isoformat())
    return removed


def run_day() -> date:
    """The run's day (UTC): its logical date, or run_after for a run without one."""
    context = get_current_context()
    when = context.get("logical_date") or context["dag_run"].run_after
    return pendulum.instance(when).in_timezone("UTC").date()


with DAG(
    dag_id="olympus_weather_archive",
    dag_display_name="Olympus Weather Archive",
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

    @task(task_display_name="Copy sealed days to NAS")
    def copy() -> None:
        from airflow.providers.sftp.hooks.sftp import SFTPHook

        with SFTPHook(ssh_conn_id=CONNECTION).get_managed_conn() as sftp:
            copy_all(sftp, ARCHIVE, REMOTE_ROOT)

    @task(task_display_name="Prune copied local days")
    def prune() -> None:
        from airflow.providers.sftp.hooks.sftp import SFTPHook

        with SFTPHook(ssh_conn_id=CONNECTION).get_managed_conn() as sftp:
            prune_all(sftp, ARCHIVE, REMOTE_ROOT, run_day(), KEEP_DAYS)

    copy() >> prune()
