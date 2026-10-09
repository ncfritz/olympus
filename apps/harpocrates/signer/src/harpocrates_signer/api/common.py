"""What every router shares: the signer, the token, the error responses."""

import hmac
from typing import Annotated, Any

from fastapi import Depends, Header, Request

from harpocrates_signer.errors import UnauthorizedError
from harpocrates_signer.models import ErrorResponse
from harpocrates_signer.signer import Signer


def get_signer(request: Request) -> Signer:
    signer: Signer = request.app.state.signer
    return signer


SignerDep = Annotated[Signer, Depends(get_signer)]


def require_token(
    signer: SignerDep,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """The shared token (ADR 0020, The signer), as `Authorization: Bearer`."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.encode("utf-8"), signer.token.encode("utf-8")
    ):
        raise UnauthorizedError("a valid token is required")


def errors(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """Document these error responses, with the 401 every route can give."""
    descriptions = {
        400: "The request is malformed.",
        401: "No token, or the wrong one.",
        403: "The passphrase is wrong.",
        404: "Not found.",
        409: "The store is not in the state this needs.",
        422: "Refused: one of the signer's invariants (see `invariant`).",
        503: "The signer is sealed.",
    }
    return {
        status: {"model": ErrorResponse, "description": descriptions[status]}
        for status in sorted({401, *statuses})
    }
