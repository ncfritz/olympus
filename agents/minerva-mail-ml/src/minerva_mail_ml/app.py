"""The HTTP service: health and metrics for now.

The featurize, suggest and learn routes arrive with phase 3 of
docs/plans/email-management, behind the service certificate check.
"""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_client import make_asgi_app

from minerva_mail_ml import __version__
from minerva_mail_ml.config import Config


def create_app(config: Config) -> FastAPI:
    app = FastAPI(title=config.app_name, version=__version__)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    # Prometheus, as every Olympus service (ADR 0017).
    app.mount("/metrics", make_asgi_app())
    return app
