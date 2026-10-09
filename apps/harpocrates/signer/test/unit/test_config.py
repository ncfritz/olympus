from datetime import timedelta
from pathlib import Path

import pytest

from harpocrates_signer.config import ConfigError, read_config, read_token

REQUIRED = {
    "SIGNER_SOCKET_PATH": "/run/harpocrates/signer.sock",
    "SIGNER_STORE_PATH": "/var/lib/harpocrates/signer.db",
    "SIGNER_TOKEN_FILE": "/run/secrets/harpocrates_signer_token",
}


def test_reads_the_paths_and_defaults_the_rest():
    config = read_config(REQUIRED)
    assert config.socket_path == Path("/run/harpocrates/signer.sock")
    assert config.store_path == Path("/var/lib/harpocrates/signer.db")
    assert config.unseal_key_file is None
    assert config.ceremony_timeout == timedelta(hours=1)
    assert config.log_level == "INFO"


def test_reads_the_optional_settings():
    config = read_config(
        {
            **REQUIRED,
            "SIGNER_UNSEAL_KEY_FILE": "/run/secrets/harpocrates_signer_unseal_key",
            "SIGNER_CEREMONY_TIMEOUT_SECONDS": "600",
            "SIGNER_LOG_LEVEL": "debug",
        }
    )
    assert config.unseal_key_file == Path("/run/secrets/harpocrates_signer_unseal_key")
    assert config.ceremony_timeout == timedelta(minutes=10)
    assert config.log_level == "DEBUG"


def test_lists_every_problem_together():
    with pytest.raises(ConfigError) as raised:
        read_config(
            {"SIGNER_LOG_LEVEL": "loud", "SIGNER_CEREMONY_TIMEOUT_SECONDS": "7200"}
        )
    assert len(raised.value.problems) == 5
    assert "SIGNER_SOCKET_PATH is required" in raised.value.problems


def test_refuses_a_short_token(tmp_path: Path):
    token = tmp_path / "token"
    token.write_text("short")
    with pytest.raises(ConfigError):
        read_token(token)
    token.write_text("x" * 32 + "\n")
    assert read_token(token) == "x" * 32
