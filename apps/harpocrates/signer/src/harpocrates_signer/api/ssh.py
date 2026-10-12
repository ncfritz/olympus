"""SSH CAs: register one, and sign SSH certificates with it (ADR 0035)."""

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.models import (
    PreviewSshCertificateRequest,
    RegisterSshCaRequest,
    SshCaResponse,
    SshCertificateResponse,
    SshCertificateSpec,
    ssh_certificate_request,
)

router = APIRouter(prefix="/v1", tags=["SSH"], dependencies=[Depends(require_token)])


@router.post(
    "/ssh/cas",
    summary="Registers an SSH CA",
    description="An issuer's Ed25519 key that signs user or host "
    "certificates, never both, and never an X.509 issuer's key too; with the "
    "longest certificate it signs.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 409, 422),
)
def register_ssh_ca(body: RegisterSshCaRequest, signer: SignerDep) -> SshCaResponse:
    return SshCaResponse.of(
        signer.ssh_cas.register(
            body.id, body.key_id, body.kind, body.max_validity_seconds
        )
    )


@router.get(
    "/ssh/cas/{ca_id}",
    summary="Describes an SSH CA",
    description="Its kind, maximum validity and public key, OpenSSH format.",
    responses=errors(404),
)
def describe_ssh_ca(ca_id: str, signer: SignerDep) -> SshCaResponse:
    return SshCaResponse.of(signer.ssh_cas.get(ca_id))


@router.post(
    "/ssh/cas/{ca_id}/certificates",
    summary="Signs an SSH certificate",
    description="A certificate exactly as specified, after the invariants: "
    "the CA's own kind, within its maximum validity, at least one principal, "
    "an OpenSSH key type and never an issuer's key, and no critical options "
    "or extensions on a host certificate.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 422, 503),
)
def sign_ssh_certificate(
    ca_id: str, body: SshCertificateSpec, signer: SignerDep
) -> SshCertificateResponse:
    certificate = signer.ssh_cas.sign(ca_id, ssh_certificate_request(body))
    return SshCertificateResponse(
        certificate=certificate.public_bytes().decode("ascii")
    )


@router.post(
    "/previews/ssh-certificates",
    summary="Previews an SSH certificate",
    description="The certificate a CA of the given kind and maximum validity "
    "would sign from this spec, after the same invariants, signed by a "
    "throwaway Ed25519 key: it reads as the real one would and never "
    "verifies. No CA key is used, so it answers while sealed.",
    responses=errors(400, 422),
)
def preview_ssh_certificate(
    body: PreviewSshCertificateRequest, signer: SignerDep
) -> SshCertificateResponse:
    certificate = signer.ssh_cas.preview(
        ssh_certificate_request(body.certificate),
        body.kind,
        body.max_validity_seconds,
    )
    return SshCertificateResponse(
        certificate=certificate.public_bytes().decode("ascii")
    )
