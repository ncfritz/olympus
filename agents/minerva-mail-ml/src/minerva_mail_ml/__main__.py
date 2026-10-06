"""Starts the service: `python -m minerva_mail_ml` or `minerva-mail-ml`.

Two listeners in one process: the plain one for /health and /metrics, and
the services one, mutual TLS, for every route that takes text.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import signal
import sys

import uvicorn

from minerva_mail_ml.app import create_app
from minerva_mail_ml.config import Config, ConfigError, read_config
from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.services_app import create_services_app
from minerva_mail_ml.tls import allowed_clients_protocol, services_ssl_context
from minerva_mail_ml.training.registry import ModelRegistry
from minerva_mail_ml.training.serving import ServingModels

logger = logging.getLogger("minerva_mail_ml")


class _Server(uvicorn.Server):
    """A uvicorn server that leaves signals to main(), which stops both."""

    @contextlib.contextmanager
    def capture_signals(self):  # type: ignore[override]
        yield


def servers(
    config: Config, store: FeatureStore, models: ServingModels
) -> list[uvicorn.Server]:
    plain = _Server(
        uvicorn.Config(
            create_app(config, store),
            host="0.0.0.0",
            port=config.port,
            log_level=config.log_level,
        )
    )
    if config.services_tls is None:
        logger.warning(
            "No services listener: TLS_CERT, TLS_KEY, TLS_CA_SERVICES and"
            " SERVICES_ISSUER are unset, so nothing can send text"
        )
        return [plain]
    services_config = uvicorn.Config(
        create_services_app(store, models),
        host="0.0.0.0",
        port=config.services_port,
        log_level=config.log_level,
        http=allowed_clients_protocol(config.services_tls),
        # A message batch can be large; uvicorn's default limit is fine,
        # but no access log line should ever carry more than a path.
        access_log=True,
    )
    services_config.load()
    services_config.ssl = services_ssl_context(config.services_tls)
    return [plain, _Server(services_config)]


async def serve(running: list[uvicorn.Server]) -> None:
    loop = asyncio.get_running_loop()

    def stop() -> None:
        for server in running:
            server.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop)
    await asyncio.gather(*(server.serve() for server in running))


def main() -> None:
    try:
        # Fails fast, listing every invalid variable, before anything starts.
        config = read_config()
    except ConfigError as error:
        logging.basicConfig(level=logging.ERROR)
        logger.error("%s", error)
        sys.exit(1)

    logging.basicConfig(
        level=config.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    store = FeatureStore(config.store_path)
    registry = ModelRegistry(config.model_dir)
    running = servers(config, store, ServingModels(registry))
    logger.info(
        "Minerva mail classifier listening on %d%s",
        config.port,
        f", services on {config.services_port}" if len(running) > 1 else "",
    )
    try:
        asyncio.run(serve(running))
    finally:
        registry.close()
        store.close()


if __name__ == "__main__":
    main()
