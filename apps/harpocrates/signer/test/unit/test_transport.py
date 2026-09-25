import socket
import threading
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
import uvicorn

from harpocrates_signer.__main__ import main
from harpocrates_signer.app import create_app
from harpocrates_signer.transport import get_over_socket, prepare_socket


@pytest.fixture
def socket_path() -> Iterator[Path]:
    # AF_UNIX paths are short (104 bytes on macOS); pytest's tmp_path is not.
    path = Path(f"/tmp/harpocrates-test-{time.monotonic_ns()}") / "signer.sock"
    yield path
    path.unlink(missing_ok=True)
    path.parent.rmdir()


@pytest.fixture
def serving(socket_path: Path) -> Iterator[Path]:
    """The app served on a real Unix socket, as `serve` runs it."""
    prepare_socket(socket_path)
    server = uvicorn.Server(
        uvicorn.Config(create_app(), uds=str(socket_path), log_level="error")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started:
        assert time.monotonic() < deadline, "the server did not start"
        time.sleep(0.01)
    yield socket_path
    server.should_exit = True
    thread.join(timeout=5)


def test_answers_health_on_its_socket(serving: Path):
    assert get_over_socket(serving, "/health") == 200


def test_the_health_command_checks_the_socket(
    serving: Path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setenv("SIGNER_SOCKET_PATH", str(serving))
    assert main(["health"]) == 0


def test_the_health_command_fails_when_nothing_answers(
    socket_path: Path, monkeypatch: pytest.MonkeyPatch
):
    socket_path.parent.mkdir()
    monkeypatch.setenv("SIGNER_SOCKET_PATH", str(socket_path))
    assert main(["health"]) == 1


def test_a_stale_socket_is_removed_before_binding(socket_path: Path):
    socket_path.parent.mkdir()
    stale = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    stale.bind(str(socket_path))
    stale.close()
    prepare_socket(socket_path)
    assert not socket_path.exists()


def test_the_socket_directory_is_not_world_readable(socket_path: Path):
    prepare_socket(socket_path)
    assert socket_path.parent.stat().st_mode & 0o007 == 0
