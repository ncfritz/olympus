"""The service's configuration, from environment variables.

Every variable is read here and nowhere else (docs/conventions/python.md).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

APP_NAME = "minerva-mail-ml"
DEFAULT_PORT = 3106
DEFAULT_SERVICES_PORT = 3107
DEFAULT_STORE = "data/features.sqlite3"
DEFAULT_MODELS = "data/models"


class ConfigError(ValueError):
    """Every invalid or missing variable, listed at once."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("Invalid configuration:\n  " + "\n  ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class ServicesTls:
    """The services listener's TLS: the only way text reaches the service.

    Clients present a certificate from the services issuer (ADR 0018,
    0023), and only the services named in `allowed_clients` get in.
    """

    cert: Path
    key: Path
    ca: Path
    crls: tuple[Path, ...]
    issuer: str
    allowed_clients: frozenset[str]


@dataclass(frozen=True)
class ApiClient:
    """How the service calls the API: its services listener, with the
    classifier's own client certificate (ADR 0018, 0023)."""

    base_url: str
    cert: Path
    key: Path
    ca: Path


@dataclass(frozen=True)
class Config:
    app_name: str
    environment: str
    port: int
    log_level: str
    store_path: Path
    services_port: int
    # None: no services listener, so nothing can send text (a warning at
    # start-up; the plain listener still serves /health and /metrics).
    services_tls: ServicesTls | None = field(default=None)
    model_dir: Path = Path(DEFAULT_MODELS)
    # None: the API is not configured, so nothing can be trained.
    api: ApiClient | None = field(default=None)


def _port(env: Mapping[str, str], name: str, default: int, problems: list[str]) -> int:
    raw = env.get(name, str(default))
    if raw.isdigit() and 1 <= int(raw) <= 65535:
        return int(raw)
    problems.append(f'{name} must be a port number, got "{raw}"')
    return default


def _services_tls(env: Mapping[str, str], problems: list[str]) -> ServicesTls | None:
    names = ("TLS_CERT", "TLS_KEY", "TLS_CA_SERVICES", "SERVICES_ISSUER")
    given = [n for n in names if env.get(n)]
    if not given:
        return None
    missing = [n for n in names if not env.get(n)]
    if missing:
        problems.append(
            "The services listener needs all of "
            + ", ".join(names)
            + "; missing "
            + ", ".join(missing)
        )
        return None
    paths = {n: Path(env[n]) for n in ("TLS_CERT", "TLS_KEY", "TLS_CA_SERVICES")}
    crls = tuple(
        Path(p.strip()) for p in env.get("TLS_CRL_SERVICES", "").split(",") if p.strip()
    )
    for name, path in [*paths.items(), *(("TLS_CRL_SERVICES", p) for p in crls)]:
        if not path.is_file():
            problems.append(f"{name}: no file at {path}")
    allowed = frozenset(
        c.strip()
        for c in env.get("SERVICES_ALLOWED_CLIENTS", "minerva-mail-agent").split(",")
        if c.strip()
    )
    if not allowed:
        problems.append("SERVICES_ALLOWED_CLIENTS names no service")
    return ServicesTls(
        cert=paths["TLS_CERT"],
        key=paths["TLS_KEY"],
        ca=paths["TLS_CA_SERVICES"],
        crls=crls,
        issuer=env["SERVICES_ISSUER"],
        allowed_clients=allowed,
    )


def _api_client(env: Mapping[str, str], problems: list[str]) -> ApiClient | None:
    names = ("API_BASE_URL", "API_CLIENT_CERT", "API_CLIENT_KEY", "API_CA_CERT")
    if not any(env.get(n) for n in names):
        return None
    missing = [n for n in names if not env.get(n)]
    if missing:
        problems.append(
            "Calling the API needs all of "
            + ", ".join(names)
            + "; missing "
            + ", ".join(missing)
        )
        return None
    base_url = env["API_BASE_URL"].rstrip("/")
    if not base_url.startswith("https://"):
        problems.append(f'API_BASE_URL must be https, got "{base_url}"')
    paths = {n: Path(env[n]) for n in names[1:]}
    for name, path in paths.items():
        if not path.is_file():
            problems.append(f"{name}: no file at {path}")
    return ApiClient(
        base_url=base_url,
        cert=paths["API_CLIENT_CERT"],
        key=paths["API_CLIENT_KEY"],
        ca=paths["API_CA_CERT"],
    )


def read_config(env: Mapping[str, str] | None = None) -> Config:
    """Reads and validates the configuration; raises ConfigError on problems."""
    env = os.environ if env is None else env
    problems: list[str] = []

    port = _port(env, "LISTEN_PORT", DEFAULT_PORT, problems)
    services_port = _port(env, "SERVICES_LISTEN_PORT", DEFAULT_SERVICES_PORT, problems)
    if port == services_port:
        problems.append("LISTEN_PORT and SERVICES_LISTEN_PORT must differ")

    log_level = env.get("LOG_LEVEL", "info").lower()
    if log_level not in {"debug", "info", "warning", "error"}:
        problems.append(
            f'LOG_LEVEL is one of debug, info, warning, error, got "{log_level}"'
        )

    services_tls = _services_tls(env, problems)
    api = _api_client(env, problems)

    if problems:
        raise ConfigError(problems)
    return Config(
        app_name=env.get("APP_NAME", APP_NAME),
        environment=env.get("ENVIRONMENT", "development"),
        port=port,
        log_level=log_level,
        store_path=Path(env.get("FEATURE_STORE_PATH", DEFAULT_STORE)),
        services_port=services_port,
        services_tls=services_tls,
        model_dir=Path(env.get("MODEL_DIR", DEFAULT_MODELS)),
        api=api,
    )
