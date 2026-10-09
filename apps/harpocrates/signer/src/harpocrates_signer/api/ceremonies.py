"""Ceremonies for offline CAs, and creating a root."""

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.ceremonies import CeremonyInfo
from harpocrates_signer.errors import NotFoundError
from harpocrates_signer.models import (
    CeremonyResponse,
    CertificateResponse,
    CertificateSpec,
    CrlResponse,
    CrlSpec,
    OfflineCaResponse,
    OfflineCaSpec,
    OpenCeremonyRequest,
    certificate_request,
    crl_request,
    pem_certificate,
    pem_crl,
)

router = APIRouter(
    prefix="/v1", tags=["Ceremonies"], dependencies=[Depends(require_token)]
)


def _response(info: CeremonyInfo | None) -> CeremonyResponse:
    if info is None:
        raise NotFoundError("no ceremony is open")
    return CeremonyResponse(
        id=info.id,
        subject=info.subject,
        opened_at=info.opened_at,
        expires_at=info.expires_at,
    )


@router.post(
    "/ceremonies",
    summary="Opens a ceremony",
    description="Imports an offline CA's key for this ceremony only. It is "
    "forgotten when the ceremony closes, times out, the signer is sealed or "
    "restarts; one ceremony at a time.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 409, 422, 503),
)
def open_ceremony(body: OpenCeremonyRequest, signer: SignerDep) -> CeremonyResponse:
    return _response(
        signer.ceremonies.open(body.private_key, body.passphrase, body.certificate)
    )


@router.get(
    "/ceremonies/current",
    summary="Describes the open ceremony",
    description="The open ceremony, or 404 when there is none.",
    responses=errors(404),
)
def describe_ceremony(signer: SignerDep) -> CeremonyResponse:
    return _response(signer.ceremonies.current())


@router.delete(
    "/ceremonies/{ceremony_id}",
    summary="Closes a ceremony",
    description="Forgets the offline CA's key.",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=errors(404),
)
def close_ceremony(ceremony_id: str, signer: SignerDep) -> None:
    signer.ceremonies.close(ceremony_id)


@router.post(
    "/ceremonies/{ceremony_id}/certificates",
    summary="Signs a certificate in a ceremony",
    description="A CA below the ceremony's (a path length below its own): "
    "an intermediate, an issuing CA whose key is in the store, or a "
    "cross-signed successor. A root that signs directly (path length 0) "
    "signs leaves instead, never a CA.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def sign_ceremony_certificate(
    ceremony_id: str, body: CertificateSpec, signer: SignerDep
) -> CertificateResponse:
    certificate = signer.ceremonies.sign_certificate(
        ceremony_id, certificate_request(body, signer.keys)
    )
    return CertificateResponse(certificate=pem_certificate(certificate))


@router.post(
    "/ceremonies/{ceremony_id}/crls",
    summary="Signs a revocation list in a ceremony",
    description="The offline CA's own list.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def sign_ceremony_crl(
    ceremony_id: str, body: CrlSpec, signer: SignerDep
) -> CrlResponse:
    return CrlResponse(
        crl=pem_crl(signer.ceremonies.sign_crl(ceremony_id, crl_request(body)))
    )


@router.post(
    "/ceremonies/{ceremony_id}/cas",
    summary="Creates an offline intermediate in a ceremony",
    description="Generates a key, has the ceremony's CA sign it, and returns "
    "the key encrypted, once. The signer keeps nothing.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def create_intermediate_ca(
    ceremony_id: str, body: OfflineCaSpec, signer: SignerDep
) -> OfflineCaResponse:
    created = signer.ceremonies.create_offline_ca(
        ceremony_id,
        certificate_request(body.certificate, signer.keys, generated_key=True),
        body.algorithm,
        body.export_passphrase,
    )
    return OfflineCaResponse(
        certificate=pem_certificate(created.certificate),
        encrypted_key=created.encrypted_key.decode("ascii"),
    )


@router.post(
    "/roots",
    summary="Creates a root",
    description="Generates a key, self-signs, and returns the key encrypted, "
    "once. The signer keeps nothing: the root is offline from its first "
    "moment.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 422, 503),
)
def create_root_ca(body: OfflineCaSpec, signer: SignerDep) -> OfflineCaResponse:
    created = signer.ceremonies.create_offline_ca(
        None,
        certificate_request(body.certificate, signer.keys, generated_key=True),
        body.algorithm,
        body.export_passphrase,
    )
    return OfflineCaResponse(
        certificate=pem_certificate(created.certificate),
        encrypted_key=created.encrypted_key.decode("ascii"),
    )
