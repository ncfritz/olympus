"""The signer's configuration, from environment variables (dev.env.example)."""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")


class ConfigError(Exception):
    """Every invalid or missing variable, reported together."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("Invalid configuration:\n  " + "\n  ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Config:
    #: The Unix socket the API listens on; there is no TCP listener.
    socket_path: Path
    log_level: str


def read_config(env: Mapping[str, str]) -> Config:
    """Read and validate the configuration.

    Raises ConfigError listing every problem, before anything starts.
    """
    problems: list[str] = []

    socket = env.get("SIGNER_SOCKET_PATH", "").strip()
    if not socket:
        problems.append("SIGNER_SOCKET_PATH is required")

    log_level = env.get("SIGNER_LOG_LEVEL", "INFO").strip().upper()
    if log_level not in LOG_LEVELS:
        problems.append(
            f"SIGNER_LOG_LEVEL must be one of {', '.join(LOG_LEVELS)}, "
            f'got "{log_level}"'
        )

    if problems:
        raise ConfigError(problems)
    return Config(socket_path=Path(socket), log_level=log_level)
