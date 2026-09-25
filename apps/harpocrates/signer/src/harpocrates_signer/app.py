"""The signer's HTTP API, served on a Unix socket only (ADR 0020)."""

from importlib.metadata import version

from fastapi import FastAPI
from fastapi.routing import APIRoute

from harpocrates_signer.health import router as health_router

TITLE = "Harpocrates Signer API"


def operation_id(route: APIRoute) -> str:
    """An operation's id is its route's name, PascalCase (docs/conventions/api.md)."""
    return "".join(part.capitalize() for part in route.name.split("_"))


def create_app() -> FastAPI:
    """The application, with every route; nothing is opened until it serves."""
    app = FastAPI(
        title=TITLE,
        description=(
            "The signer of Harpocrates, the internal certificate authority: "
            "keys, certificate and revocation list signing, and escrow. "
            "Reached only over a Unix socket, by the Harpocrates service."
        ),
        version=version("harpocrates-signer"),
        contact={
            "name": "Neil Fritz",
            "url": "https://ncfritz.net",
            "email": "ncfritz@ncfritz.net",
        },
        generate_unique_id_function=operation_id,
        # The document is committed (openapi/signer.json); nothing serves it.
        openapi_url=None,
        docs_url=None,
        redoc_url=None,
    )
    app.include_router(health_router)
    return app
