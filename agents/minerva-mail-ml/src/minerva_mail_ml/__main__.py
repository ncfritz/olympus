"""Starts the service: `python -m minerva_mail_ml` or `minerva-mail-ml`."""

from __future__ import annotations

import logging
import sys

import uvicorn

from minerva_mail_ml.app import create_app
from minerva_mail_ml.config import ConfigError, read_config

logger = logging.getLogger("minerva_mail_ml")


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
    logger.info("Minerva mail classifier listening on %d", config.port)
    uvicorn.run(
        create_app(config),
        host="0.0.0.0",
        port=config.port,
        log_level=config.log_level,
    )


if __name__ == "__main__":
    main()
