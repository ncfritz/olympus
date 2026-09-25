from pathlib import Path

import pytest

from harpocrates_signer.config import ConfigError, read_config


def test_reads_the_socket_and_defaults_the_log_level():
    config = read_config({"SIGNER_SOCKET_PATH": "/run/harpocrates/signer.sock"})
    assert config.socket_path == Path("/run/harpocrates/signer.sock")
    assert config.log_level == "INFO"


def test_accepts_a_log_level_in_any_case():
    config = read_config({"SIGNER_SOCKET_PATH": "s.sock", "SIGNER_LOG_LEVEL": "debug"})
    assert config.log_level == "DEBUG"


def test_lists_every_problem_together():
    with pytest.raises(ConfigError) as raised:
        read_config({"SIGNER_LOG_LEVEL": "loud"})
    assert len(raised.value.problems) == 2
    assert "SIGNER_SOCKET_PATH is required" in raised.value.problems
