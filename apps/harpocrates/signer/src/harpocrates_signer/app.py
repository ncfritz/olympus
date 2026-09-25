"""The signer's HTTP API, served on a Unix socket only (ADR 0020)."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from harpocrates_signer.api import ceremonies, issuers, keys, seal
from harpocrates_signer.api.health import router as health_router
from harpocrates_signer.config import Config, read_config
from harpocrates_signer.errors import RefusedError, SignerError
from harpocrates_signer.models import ErrorResponse
from harpocrates_signer.signer import Signer

TITLE = "Harpocrates Signer API"

TAGS = [
    {"name": "Seal", "description": "Initialise, unseal, seal, and their secrets."},
    {"name": "Keys", "description": "Generate, import, destroy and export keys."},
    {"name": "Issuers", "description": "Online issuers and what they sign."},
    {"name": "Ceremonies", "description": "Offline CAs, one ceremony at a time."},
]


def operation_id(route: APIRoute) -> str:
    """An operation's id is its route's name, PascalCase (docs/conventions/api.md)."""
    return "".join(part.capitalize() for part in route.name.split("_"))


def _error(error: SignerError) -> JSONResponse:
    body = ErrorResponse(
        error=error.code,
        message=error.message,
        invariant=error.invariant if isinstance(error, RefusedError) else None,
    )
    return JSONResponse(
        status_code=error.status,
        content=body.model_dump(by_alias=True, exclude_none=True),
    )


async def _signer_error(_: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, SignerError):
        raise error
    return _error(error)


async def _validation_error(_: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise error
    problems = "; ".join(
        f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in error.errors()
    )
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(error="bad-request", message=problems).model_dump(
            by_alias=True, exclude_none=True
        ),
    )


def create_app(config: Config | None = None) -> FastAPI:
    """The application, with every route. The signer itself is created when
    the app starts, from `config` or the environment; the OpenAPI document
    needs neither."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        signer = Signer(config or read_config(os.environ))
        signer.start()
        app.state.signer = signer
        try:
            yield
        finally:
            signer.close()

    app = FastAPI(
        title=TITLE,
        description=(
            "The signer of Harpocrates, the internal certificate authority: "
            "keys, certificate and revocation list signing, ceremonies and "
            "escrow. Reached only over a Unix socket, by the Harpocrates "
            "service, with a shared token."
        ),
        version=version("harpocrates-signer"),
        contact={
            "name": "Neil Fritz",
            "url": "https://ncfritz.net",
            "email": "ncfritz@ncfritz.net",
        },
        openapi_tags=TAGS,
        generate_unique_id_function=operation_id,
        lifespan=lifespan,
        # The document is committed (openapi/signer.json); nothing serves it.
        openapi_url=None,
        docs_url=None,
        redoc_url=None,
    )
    app.add_exception_handler(SignerError, _signer_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.include_router(health_router)
    for feature in (seal, keys, issuers, ceremonies):
        app.include_router(feature.router)
    return app
