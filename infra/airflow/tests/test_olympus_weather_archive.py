"""The weather archive DAG's copy and prune, against a fake SFTP client.

    python -m pytest infra/airflow/tests

in a virtualenv with Airflow 3 and apache-airflow-providers-sftp (the DAG file
is imported, and reads infra/docker/env/prod.env from this checkout).
"""

from __future__ import annotations

import errno
import hashlib
import importlib.util
import io
import shutil
from datetime import date
from pathlib import Path

import pytest

DAGS = Path(__file__).resolve().parents[1] / "dags"
spec = importlib.util.spec_from_file_location(
    "olympus_weather_archive", DAGS / "olympus_weather_archive.py"
)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

MAC = "E8-DB-84-E6-49-FD"
REMOTE = "/Weather"


class FakeSftp:
    """paramiko's SFTPClient over a local directory standing in for the NAS."""

    def __init__(self, root: Path):
        self.root = root
        self.puts: list[str] = []

    def _local(self, path: str) -> Path:
        return self.root / path.lstrip("/")

    def open(self, filename, mode="r"):
        path = self._local(filename)
        if not path.exists():
            raise FileNotFoundError(errno.ENOENT, "No such file", filename)
        return path.open("rb")

    def putfo(self, fl, remotepath):
        self.puts.append(remotepath)
        path = self._local(remotepath)
        if not path.parent.is_dir():
            raise FileNotFoundError(errno.ENOENT, "No such directory", remotepath)
        path.write_bytes(fl.read())

    def rename(self, oldpath, newpath):
        if self._local(newpath).exists():
            raise OSError(errno.EEXIST, "exists", newpath)
        self._local(oldpath).rename(self._local(newpath))

    def remove(self, path):
        local = self._local(path)
        if not local.exists():
            raise FileNotFoundError(errno.ENOENT, "No such file", path)
        local.unlink()

    def mkdir(self, path):
        self._local(path).mkdir()

    def stat(self, path):
        local = self._local(path)
        if not local.exists():
            raise FileNotFoundError(errno.ENOENT, "No such file", path)
        return local.stat()


def seal(root: Path, day: str, content: bytes = b"zstd bytes") -> str:
    """A sealed day as the API leaves it: the .zst and its sha256sum file."""
    year, month, dd = day.split("-")
    relative = f"{MAC}/{year}/{month}/{dd}.jsonl.zst"
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    digest = hashlib.sha256(content).hexdigest()
    path.with_name(path.name + ".sha256").write_text(f"{digest}  {dd}.jsonl.zst\n")
    return relative


@pytest.fixture
def local(tmp_path):
    root = tmp_path / "archive"
    root.mkdir()
    return root


@pytest.fixture
def nas(tmp_path):
    root = tmp_path / "nas"
    (root / "Weather").mkdir(parents=True)
    return FakeSftp(root)


def on_nas(nas: FakeSftp, relative: str) -> Path:
    return nas.root / "Weather" / relative


def test_copies_a_sealed_day_with_its_checksum(local, nas):
    relative = seal(local, "2026-10-01", b"day one")
    assert archive.copy_all(nas, local, REMOTE) == (1, 0)
    assert on_nas(nas, relative).read_bytes() == b"day one"
    assert on_nas(nas, relative + ".sha256").read_text().startswith(
        hashlib.sha256(b"day one").hexdigest()
    )
    # Under a temporary name until whole.
    assert nas.puts[0].endswith(".jsonl.zst.partial")
    assert not on_nas(nas, relative + ".partial").exists()


def test_skips_a_day_already_there_whole(local, nas):
    seal(local, "2026-10-01")
    archive.copy_all(nas, local, REMOTE)
    nas.puts.clear()
    assert archive.copy_all(nas, local, REMOTE) == (0, 1)
    assert nas.puts == []


def test_replaces_a_nas_copy_that_does_not_check(local, nas):
    relative = seal(local, "2026-10-01", b"the real day")
    target = on_nas(nas, relative)
    target.parent.mkdir(parents=True)
    target.write_bytes(b"truncat")
    assert archive.copy_all(nas, local, REMOTE) == (1, 0)
    assert target.read_bytes() == b"the real day"


def test_leaves_a_day_still_being_written(local, nas):
    open_day = local / MAC / "2026" / "10" / "02.jsonl"
    open_day.parent.mkdir(parents=True)
    open_day.write_text("{}\n")
    assert archive.copy_all(nas, local, REMOTE) == (0, 0)


def test_refuses_a_local_day_that_does_not_match_its_checksum(local, nas):
    relative = seal(local, "2026-10-01", b"good")
    (local / relative).write_bytes(b"bad")
    with pytest.raises(archive.CopyFailed, match="did not copy"):
        archive.copy_all(nas, local, REMOTE)
    assert not on_nas(nas, relative).exists()


def test_fails_when_the_nas_copy_does_not_check(local, nas, monkeypatch):
    seal(local, "2026-10-01", b"good")
    original = nas.putfo

    def mangle(fl, remotepath):
        original(io.BytesIO(b"mangled") if remotepath.endswith(".partial") else fl, remotepath)

    monkeypatch.setattr(nas, "putfo", mangle)
    with pytest.raises(archive.CopyFailed, match="did not copy"):
        archive.copy_all(nas, local, REMOTE)


def test_prunes_only_old_days_whose_nas_copy_checks(local, nas):
    old_copied = seal(local, "2026-08-01", b"old, copied")
    old_missing = seal(local, "2026-08-02", b"old, never copied")
    recent = seal(local, "2026-09-25", b"recent")
    archive.copy_all(nas, local, REMOTE)
    on_nas(nas, old_missing).unlink()

    removed = archive.prune_all(nas, local, REMOTE, date(2026, 10, 1), 30)

    assert removed == 1
    assert not (local / old_copied).exists()
    assert not (local / (old_copied + ".sha256")).exists()
    assert (local / old_missing).exists()
    assert (local / recent).exists()


def test_finds_days_oldest_first_across_stations(local):
    seal(local, "2026-10-02")
    other = "0A-1B-2C-3D-4E-5F/2026/10/01.jsonl.zst"
    (local / other).parent.mkdir(parents=True)
    (local / other).write_bytes(b"x")
    (local / (other + ".sha256")).write_text(hashlib.sha256(b"x").hexdigest() + "  01.jsonl.zst\n")
    assert archive.sealed_days(local)[0] == other


def test_makes_the_nas_folders_a_level_at_a_time(local, nas):
    relative = seal(local, "2026-10-01")
    archive.copy_all(nas, local, REMOTE)
    assert on_nas(nas, relative).parent.is_dir()
