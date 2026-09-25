"""The signer's configuration, from environment variables (dev.env.example)."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")
DEFAULT_CEREMONY_TIMEOUT = timedelta(hours=1)


class ConfigError(Exception):
    """Every invalid or missing variable, reported together."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("Invalid configuration:\n  " + "\n  ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Config:
    #: The Unix socket the API listens on; there is no TCP listener.
    socket_path: Path
    #: The SQLite store: wrapped keys and the wrapped master key.
    store_path: Path
    #: The shared token callers present (a Compose secret).
    token_file: Path
    #: The unseal key (a Compose secret). Unset or missing: start sealed.
    unseal_key_file: Path | None
    ceremony_timeout: timedelta
    log_level: str


def _required_path(env: Mapping[str, str], name: str, problems: list[str]) -> Path:
    value = env.get(name, "").strip()
    if not value:
        problems.append(f"{name} is required")
    return Path(value)


def read_config(env: Mapping[str, str]) -> Config:
    """Read and validate the configuration.

    Raises ConfigError listing every problem, before anything starts.
    """
    problems: list[str] = []

    socket_path = _required_path(env, "SIGNER_SOCKET_PATH", problems)
    store_path = _required_path(env, "SIGNER_STORE_PATH", problems)
    token_file = _required_path(env, "SIGNER_TOKEN_FILE", problems)
    unseal = env.get("SIGNER_UNSEAL_KEY_FILE", "").strip()

    timeout = DEFAULT_CEREMONY_TIMEOUT
    raw_timeout = env.get("SIGNER_CEREMONY_TIMEOUT_SECONDS", "").strip()
    if raw_timeout:
        if raw_timeout.isdigit() and 0 < int(raw_timeout) <= 3600:
            timeout = timedelta(seconds=int(raw_timeout))
        else:
            problems.append(
                "SIGNER_CEREMONY_TIMEOUT_SECONDS must be 1 to 3600, "
                f'got "{raw_timeout}"'
            )

    log_level = env.get("SIGNER_LOG_LEVEL", "INFO").strip().upper()
    if log_level not in LOG_LEVELS:
        problems.append(
            f"SIGNER_LOG_LEVEL must be one of {', '.join(LOG_LEVELS)}, "
            f'got "{log_level}"'
        )

    if problems:
        raise ConfigError(problems)
    return Config(
        socket_path=socket_path,
        store_path=store_path,
        token_file=token_file,
        unseal_key_file=Path(unseal) if unseal else None,
        ceremony_timeout=timeout,
        log_level=log_level,
    )


def read_token(path: Path) -> str:
    """The shared token, from its file; at least 32 characters."""
    try:
        token = path.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise ConfigError([f"cannot read the token file {path}: {error}"]) from error
    if len(token) < 32:
        raise ConfigError([f"the token in {path} is shorter than 32 characters"])
    return token
