"""Keys: generate, import, describe, destroy, and export an escrowed one."""

import base64

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.escrow import ExportFormat, export_key
from harpocrates_signer.models import (
    ExportKeyRequest,
    ExportKeyResponse,
    GenerateKeyRequest,
    ImportKeyRequest,
    KeyResponse,
    load_certificate,
)

router = APIRouter(prefix="/v1", tags=["Keys"], dependencies=[Depends(require_token)])


@router.post(
    "/keys",
    summary="Generates a key",
    description="An issuer's key (it signs) or a subject's (it is "
    "certified, and kept: escrow). Only the public key is returned.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 503),
)
def generate_key(body: GenerateKeyRequest, signer: SignerDep) -> KeyResponse:
    return KeyResponse.of(signer.keys.generate(body.purpose, body.algorithm))


@router.post(
    "/keys/import",
    summary="Imports a key",
    description="An encrypted PKCS#8 key, as XCA exports it: an issuing "
    "CA's, at the cutover. Refused if the store already holds it.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 409, 503),
)
def import_key(body: ImportKeyRequest, signer: SignerDep) -> KeyResponse:
    return KeyResponse.of(
        signer.keys.import_key(body.purpose, body.private_key, body.passphrase)
    )


@router.get(
    "/keys/{key_id}",
    summary="Describes a key",
    description="Its purpose, algorithm and public key; never the private key.",
    responses=errors(404),
)
def describe_key(key_id: str, signer: SignerDep) -> KeyResponse:
    return KeyResponse.of(signer.keys.info(key_id))


@router.delete(
    "/keys/{key_id}",
    summary="Destroys a key",
    description="Deletes an escrowed subject key for good, keeping its "
    "public key so it can never be certified again. Issuer keys are refused.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=errors(404, 409),
)
def destroy_key(key_id: str, signer: SignerDep) -> None:
    signer.keys.destroy(key_id)


@router.post(
    "/keys/{key_id}/export",
    summary="Exports an escrowed key",
    description="A subject key, encrypted: PKCS#8 PEM, PKCS#12 (AES-256), "
    "or legacy PKCS#12 (SHA-1 and 3DES, no chain). The service decides who "
    "may and records it; an issuer's key is refused.",
    responses=errors(400, 404, 422, 503),
)
def export_escrowed_key(
    key_id: str, body: ExportKeyRequest, signer: SignerDep
) -> ExportKeyResponse:
    data = export_key(
        signer.keys,
        key_id,
        ExportFormat(body.format.value),
        body.passphrase,
        None if body.certificate is None else load_certificate(body.certificate),
        tuple(load_certificate(c) for c in body.chain),
    )
    return ExportKeyResponse(
        format=body.format, data=base64.b64encode(data).decode("ascii")
    )
