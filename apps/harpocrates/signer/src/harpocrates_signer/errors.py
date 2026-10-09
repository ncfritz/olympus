"""The signer's errors. Each carries its HTTP status and a stable code;
the API turns them into an ErrorResponse at the edge (python.md)."""


class SignerError(Exception):
    status = 500
    code = "internal"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class BadRequestError(SignerError):
    """The request is malformed: a PEM that does not parse, say."""

    status = 400
    code = "bad-request"


class UnauthorizedError(SignerError):
    """No token, or the wrong one."""

    status = 401
    code = "unauthorized"


class ForbiddenError(SignerError):
    """A passphrase or secret that does not open what it should."""

    status = 403
    code = "forbidden"


class NotFoundError(SignerError):
    status = 404
    code = "not-found"


class ConflictError(SignerError):
    """The store is not in the state the operation needs."""

    status = 409
    code = "conflict"


class RefusedError(SignerError):
    """A request the signer will not sign: one of its invariants.

    `invariant` names which, so the service can record and show it; the
    message never includes key material.
    """

    status = 422
    code = "refused"

    def __init__(self, invariant: str, message: str) -> None:
        super().__init__(message)
        self.invariant = invariant


class SealedError(SignerError):
    """The keys are not available: every signing operation answers 503."""

    status = 503
    code = "sealed"
