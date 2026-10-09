"""The seal: status, initialise, unseal, seal, and rotating its secrets."""

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.models import (
    CeremonyResponse,
    ChangePassphraseRequest,
    PassphraseRequest,
    StatusResponse,
    UnsealKeyResponse,
)
from harpocrates_signer.vault import encode_unseal_key

router = APIRouter(prefix="/v1", tags=["Seal"], dependencies=[Depends(require_token)])


@router.get(
    "/status",
    summary="Describes the seal",
    description="Whether the store is initialised and unsealed, why not, "
    "and the open ceremony. Answers while sealed.",
    responses=errors(),
)
def describe_status(signer: SignerDep) -> StatusResponse:
    vault = signer.vault.status()
    ceremony = signer.ceremonies.current()
    return StatusResponse(
        initialised=vault.initialised,
        sealed=vault.sealed,
        reason=vault.reason,
        ceremony=None
        if ceremony is None
        else CeremonyResponse(
            id=ceremony.id,
            subject=ceremony.subject,
            opened_at=ceremony.opened_at,
            expires_at=ceremony.expires_at,
        ),
        keys=signer.store.count_keys(),
    )


@router.post(
    "/initialise",
    summary="Initialises the store",
    description="Sets the recovery passphrase on an empty store and returns "
    "a new unseal key, once: it becomes the `harpocrates_signer_unseal_key` "
    "secret. Refused on a store that already has a master key.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 409),
)
def initialise(body: PassphraseRequest, signer: SignerDep) -> UnsealKeyResponse:
    return UnsealKeyResponse(
        unseal_key=encode_unseal_key(signer.vault.initialise(body.passphrase))
    )


@router.post(
    "/unseal",
    summary="Unseals with the recovery passphrase",
    description="Opens the store with the recovery passphrase. This is also "
    "what lifts a deliberate seal; the unseal key alone does not.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=errors(400, 403, 409),
)
def unseal(body: PassphraseRequest, signer: SignerDep) -> None:
    signer.vault.unseal(body.passphrase)


@router.post(
    "/seal",
    summary="Seals the signer",
    description="Forgets the keys and ends any ceremony, and stays sealed "
    "across restarts until unsealed with the recovery passphrase.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=errors(409),
)
def seal(signer: SignerDep) -> None:
    signer.seal()


@router.post(
    "/unseal-key/rotate",
    summary="Rotates the unseal key",
    description="Rewraps the master key under a new unseal key and returns "
    "it, once. The old one stops working at once; replace the secret before "
    "the next restart.",
    responses=errors(503),
)
def rotate_unseal_key(signer: SignerDep) -> UnsealKeyResponse:
    return UnsealKeyResponse(
        unseal_key=encode_unseal_key(signer.vault.rotate_unseal_key())
    )


@router.put(
    "/passphrase",
    summary="Changes the recovery passphrase",
    description="Rewraps the master key under a new passphrase; the current "
    "one must be given.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=errors(400, 403, 409),
)
def change_passphrase(body: ChangePassphraseRequest, signer: SignerDep) -> None:
    signer.vault.change_passphrase(body.current, body.new)
