"""The signer's only transport: HTTP over a Unix socket (ADR 0020).

There is no TCP listener in any configuration, so nothing on any Docker
network can reach the signer; only what mounts the socket's volume can.
"""

import http.client
import logging
import socket
from pathlib import Path

import uvicorn

from harpocrates_signer.config import Config

logger = logging.getLogger(__name__)

#: The socket's directory: the owner and its group (the service) only.
SOCKET_DIR_MODE = 0o750


def prepare_socket(path: Path) -> None:
    """Create the socket's directory, and remove a socket a previous run
    left behind (a crash leaves the file, and binding to it would fail)."""
    path.parent.mkdir(mode=SOCKET_DIR_MODE, parents=True, exist_ok=True)
    if path.is_socket():
        path.unlink()


def serve(config: Config, *, reload: bool = False) -> None:
    """Serve the API on the configured socket until stopped."""
    prepare_socket(config.socket_path)
    logger.info("Serving on %s", config.socket_path)
    uvicorn.run(
        "harpocrates_signer.app:create_app",
        factory=True,
        uds=str(config.socket_path),
        reload=reload,
        log_level=config.log_level.lower(),
        # Uvicorn's own access log; requests are the service's, not a user's.
        access_log=config.log_level == "DEBUG",
    )


class _UnixConnection(http.client.HTTPConnection):
    """An HTTP connection over a Unix socket, for the health check."""

    def __init__(self, path: Path, timeout: float) -> None:
        super().__init__("signer", timeout=timeout)
        self._path = path

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(str(self._path))


def get_over_socket(path: Path, route: str, timeout: float = 5.0) -> int:
    """GET a route over the socket and return the status code."""
    connection = _UnixConnection(path, timeout)
    try:
        connection.request("GET", route)
        return connection.getresponse().status
    finally:
        connection.close()
