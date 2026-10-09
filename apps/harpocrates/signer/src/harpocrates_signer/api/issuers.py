"""Online issuers: register one, and sign certificates and lists with it."""

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.models import (
    CertificateResponse,
    CertificateSpec,
    CrlResponse,
    CrlSpec,
    IssuerResponse,
    RegisterIssuerRequest,
    certificate_request,
    crl_request,
    load_certificate,
    pem_certificate,
    pem_crl,
)

router = APIRouter(
    prefix="/v1", tags=["Issuers"], dependencies=[Depends(require_token)]
)


@router.post(
    "/issuers",
    summary="Registers an issuer",
    description="An issuing CA (path length 0) whose key is in the store, "
    "with the chain above it, its maximum validity and the extended key "
    "usages it may sign.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 409, 422),
)
def register_issuer(body: RegisterIssuerRequest, signer: SignerDep) -> IssuerResponse:
    return IssuerResponse.of(
        signer.issuers.register(
            body.id,
            body.key_id,
            load_certificate(body.certificate),
            tuple(load_certificate(c) for c in body.chain),
            body.max_validity_days,
            frozenset(body.extended_key_usages),
        )
    )


@router.get(
    "/issuers/{issuer_id}",
    summary="Describes an issuer",
    description="Its certificate, chain, maximum validity and usages.",
    responses=errors(404),
)
def describe_issuer(issuer_id: str, signer: SignerDep) -> IssuerResponse:
    return IssuerResponse.of(signer.issuers.get(issuer_id))


@router.post(
    "/issuers/{issuer_id}/certificates",
    summary="Signs a certificate",
    description="A leaf certificate exactly as specified, after the "
    "invariants: never a CA, within the issuer's validity and maximum, its "
    "usages, and every name constraint up its chain.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def sign_certificate(
    issuer_id: str, body: CertificateSpec, signer: SignerDep
) -> CertificateResponse:
    certificate = signer.issuers.sign_certificate(
        issuer_id, certificate_request(body, signer.keys)
    )
    return CertificateResponse(certificate=pem_certificate(certificate))


@router.post(
    "/issuers/{issuer_id}/crls",
    summary="Signs a revocation list",
    description="A list with the given number, dates and entries.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def sign_crl(issuer_id: str, body: CrlSpec, signer: SignerDep) -> CrlResponse:
    crl = signer.issuers.sign_crl(issuer_id, crl_request(body))
    return CrlResponse(crl=pem_crl(crl))
