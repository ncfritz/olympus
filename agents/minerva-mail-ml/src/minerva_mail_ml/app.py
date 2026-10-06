"""The plain listener: health and metrics, and nothing that takes text."""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_client import make_asgi_app

from minerva_mail_ml import __version__
from minerva_mail_ml.config import Config
from minerva_mail_ml.features.store import FeatureStore


def create_app(config: Config, store: FeatureStore) -> FastAPI:
    app = FastAPI(title=config.app_name, version=__version__)

    @app.get("/health")
    def health() -> dict[str, str | None]:
        return {
            "status": "ok",
            "version": __version__,
            "featureVersion": store.serving_version(),
        }

    # Prometheus, as every Olympus service (ADR 0017).
    app.mount("/metrics", make_asgi_app())
    return app
