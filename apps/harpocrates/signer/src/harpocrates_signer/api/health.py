"""Liveness for Docker's health check, like the Node services' /health."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", include_in_schema=False)
def health() -> dict[str, str]:
    """The process is up and serving. It checks no dependency, and does not
    say whether the signer is sealed: that is `status`, from phase 1."""
    return {"status": "ok"}
