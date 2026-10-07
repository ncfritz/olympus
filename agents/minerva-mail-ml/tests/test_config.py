from pathlib import Path

import pytest

from minerva_mail_ml.config import ConfigError, read_config


def test_defaults() -> None:
    config = read_config({})
    assert config.app_name == "minerva-mail-ml"
    assert config.port == 3106
    assert config.services_port == 3107
    assert config.log_level == "info"
    assert config.store_path == Path("data/features.sqlite3")
    assert config.services_tls is None
    assert config.model_dir == Path("data/models")
    assert config.api is None
    assert config.learn_seconds == 60


def test_reads_how_often_to_learn() -> None:
    assert read_config({"LEARN_SECONDS": "0"}).learn_seconds == 0
    assert read_config({"LEARN_SECONDS": "300"}).learn_seconds == 300
    for bad in ("-1", "often", "86401"):
        with pytest.raises(ConfigError, match="LEARN_SECONDS"):
            read_config({"LEARN_SECONDS": bad})


def test_lists_every_problem_at_once() -> None:
    with pytest.raises(ConfigError) as error:
        read_config({"LISTEN_PORT": "mail", "LOG_LEVEL": "loud"})
    assert len(error.value.problems) == 2
    assert "LISTEN_PORT" in error.value.problems[0]


@pytest.mark.parametrize("port", ["0", "65536", "-1", "80a"])
def test_refuses_a_port_that_is_not_one(port: str) -> None:
    with pytest.raises(ConfigError):
        read_config({"LISTEN_PORT": port})


def test_the_two_listeners_need_two_ports() -> None:
    with pytest.raises(ConfigError, match="must differ"):
        read_config({"LISTEN_PORT": "3107"})


def _tls_files(tmp_path: Path) -> dict[str, str]:
    files = {}
    for name in ("TLS_CERT", "TLS_KEY", "TLS_CA_SERVICES"):
        path = tmp_path / f"{name.lower()}.pem"
        path.write_text("pem")
        files[name] = str(path)
    return files


def test_reads_the_services_listener(tmp_path: Path) -> None:
    crl = tmp_path / "services.crl"
    crl.write_text("crl")
    config = read_config(
        {
            **_tls_files(tmp_path),
            "SERVICES_ISSUER": "Service Issuing CA",
            "TLS_CRL_SERVICES": f"{crl}, ",
        }
    )
    assert config.services_tls is not None
    assert config.services_tls.allowed_clients == frozenset({"minerva-mail-agent"})
    assert config.services_tls.crls == (crl,)


def test_the_services_listener_is_all_or_nothing(tmp_path: Path) -> None:
    files = _tls_files(tmp_path)
    del files["TLS_KEY"]
    with pytest.raises(ConfigError, match="missing TLS_KEY, SERVICES_ISSUER"):
        read_config(files)


def test_names_a_file_that_is_not_there(tmp_path: Path) -> None:
    files = _tls_files(tmp_path)
    with pytest.raises(ConfigError, match="TLS_CA_SERVICES: no file"):
        read_config(
            {
                **files,
                "TLS_CA_SERVICES": str(tmp_path / "gone.pem"),
                "SERVICES_ISSUER": "x",
            }
        )


def _api_files(tmp_path: Path) -> dict[str, str]:
    files = {"API_BASE_URL": "https://olympus-api:3443/v1/"}
    for name in ("API_CLIENT_CERT", "API_CLIENT_KEY", "API_CA_CERT"):
        path = tmp_path / f"{name.lower()}.pem"
        path.write_text("pem")
        files[name] = str(path)
    return files


def test_reads_the_api_client(tmp_path: Path) -> None:
    config = read_config(_api_files(tmp_path))
    assert config.api is not None
    assert config.api.base_url == "https://olympus-api:3443/v1"


def test_the_api_client_is_all_or_nothing(tmp_path: Path) -> None:
    env = _api_files(tmp_path)
    del env["API_CLIENT_KEY"]
    with pytest.raises(ConfigError, match="missing API_CLIENT_KEY"):
        read_config(env)


def test_the_api_is_called_over_https(tmp_path: Path) -> None:
    env = {**_api_files(tmp_path), "API_BASE_URL": "http://olympus-api/v1"}
    with pytest.raises(ConfigError, match="must be https"):
        read_config(env)
