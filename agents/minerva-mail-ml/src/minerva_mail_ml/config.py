"""The service's configuration, from environment variables.

Every variable is read here and nowhere else (docs/conventions/python.md).
Phase 0 of docs/plans/email-management needs only the listener; the feature
store and the API client arrive with phase 3.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

APP_NAME = "minerva-mail-ml"
DEFAULT_PORT = 3106


class ConfigError(ValueError):
    """Every invalid or missing variable, listed at once."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("Invalid configuration:\n  " + "\n  ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Config:
    app_name: str
    environment: str
    port: int
    log_level: str


def read_config(env: Mapping[str, str] | None = None) -> Config:
    """Reads and validates the configuration; raises ConfigError on problems."""
    env = os.environ if env is None else env
    problems: list[str] = []

    raw_port = env.get("LISTEN_PORT", str(DEFAULT_PORT))
    port = DEFAULT_PORT
    if raw_port.isdigit() and 1 <= int(raw_port) <= 65535:
        port = int(raw_port)
    else:
        problems.append(f'LISTEN_PORT must be a port number, got "{raw_port}"')

    log_level = env.get("LOG_LEVEL", "info").lower()
    if log_level not in {"debug", "info", "warning", "error"}:
        problems.append(
            f'LOG_LEVEL is one of debug, info, warning, error, got "{log_level}"'
        )

    if problems:
        raise ConfigError(problems)
    return Config(
        app_name=env.get("APP_NAME", APP_NAME),
        environment=env.get("ENVIRONMENT", "development"),
        port=port,
        log_level=log_level,
    )
