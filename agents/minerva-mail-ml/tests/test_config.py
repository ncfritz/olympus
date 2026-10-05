import pytest

from minerva_mail_ml.config import ConfigError, read_config


def test_defaults() -> None:
    config = read_config({})
    assert config.app_name == "minerva-mail-ml"
    assert config.port == 3106
    assert config.log_level == "info"


def test_lists_every_problem_at_once() -> None:
    with pytest.raises(ConfigError) as error:
        read_config({"LISTEN_PORT": "mail", "LOG_LEVEL": "loud"})
    assert len(error.value.problems) == 2
    assert "LISTEN_PORT" in error.value.problems[0]


@pytest.mark.parametrize("port", ["0", "65536", "-1", "80a"])
def test_refuses_a_port_that_is_not_one(port: str) -> None:
    with pytest.raises(ConfigError):
        read_config({"LISTEN_PORT": port})
