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
