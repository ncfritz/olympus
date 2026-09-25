import socket
import threading
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
import uvicorn

from harpocrates_signer.__main__ import main
from harpocrates_signer.app import create_app
from harpocrates_signer.config import Config
from harpocrates_signer.transport import (
    call_over_socket,
    get_over_socket,
    prepare_socket,
)


@pytest.fixture
def socket_path(config: Config) -> Path:
    return config.socket_path


@pytest.fixture
def env(config: Config, monkeypatch: pytest.MonkeyPatch) -> None:
    """The environment `python -m harpocrates_signer` reads."""
    monkeypatch.setenv("SIGNER_SOCKET_PATH", str(config.socket_path))
    monkeypatch.setenv("SIGNER_STORE_PATH", str(config.store_path))
    monkeypatch.setenv("SIGNER_TOKEN_FILE", str(config.token_file))


@pytest.fixture
def serving(config: Config) -> Iterator[Path]:
    """The app served on a real Unix socket, as `serve` runs it."""
    socket_path = config.socket_path
    prepare_socket(socket_path)
    server = uvicorn.Server(
        uvicorn.Config(create_app(config), uds=str(socket_path), log_level="error")
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


def test_the_health_command_checks_the_socket(serving: Path, env: None):
    assert main(["health"]) == 0


def test_the_health_command_fails_when_nothing_answers(socket_path: Path, env: None):
    assert main(["health"]) == 1


def test_the_api_needs_the_token(serving: Path, config: Config):
    status, body = call_over_socket(serving, "GET", "/v1/status", "not the token")
    assert status == 401
    assert body == {"error": "unauthorized", "message": "a valid token is required"}
    status, body = call_over_socket(
        serving, "GET", "/v1/status", config.token_file.read_text()
    )
    assert status == 200
    assert body is not None and body["reason"] == "uninitialised"


def test_the_cli_initialises_and_seals_over_the_socket(
    serving: Path, env: None, monkeypatch: pytest.MonkeyPatch, capsys
):
    monkeypatch.setattr("getpass.getpass", lambda _: "a recovery passphrase")
    assert main(["initialise"]) == 0
    assert "harpocrates_signer_unseal_key" in capsys.readouterr().out
    assert main(["seal"]) == 0
    assert main(["unseal"]) == 0
    monkeypatch.setattr("getpass.getpass", lambda _: "not the passphrase")
    with pytest.raises(SystemExit, match="the passphrase is wrong"):
        main(["unseal"])


def test_a_stale_socket_is_removed_before_binding(socket_path: Path):
    stale = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    stale.bind(str(socket_path))
    stale.close()
    prepare_socket(socket_path)
    assert not socket_path.exists()


def test_the_socket_directory_is_not_world_readable(tmp_path: Path):
    socket_path = tmp_path / "run" / "signer.sock"
    prepare_socket(socket_path)
    assert socket_path.parent.stat().st_mode & 0o007 == 0
