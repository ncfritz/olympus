"""OCSP (ADR 0036): each CA's responder, and the responses it signs."""

import base64

from fastapi import APIRouter, Depends, status

from harpocrates_signer.api.common import SignerDep, errors, require_token
from harpocrates_signer.models import (
    OcspResponsesRequest,
    OcspResponsesResponse,
    ResponderResponse,
    ResponderSpec,
    ocsp_entries,
    responder_request,
)
from harpocrates_signer.ocsp import ONLINE_RESPONDER_MAX_DAYS

router = APIRouter(prefix="/v1", tags=["OCSP"], dependencies=[Depends(require_token)])


@router.post(
    "/issuers/{issuer_id}/ocsp-responders",
    summary="Issues an online issuer's OCSP responder",
    description="A certificate for an `ocsp` key, signed by the issuer's own "
    "key: OCSPSigning only, ocsp-nocheck, valid at most 35 days. The signer "
    "keeps it, and the key signs that issuer's responses from then on.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 409, 422, 503),
)
def issue_issuer_ocsp_responder(
    issuer_id: str, body: ResponderSpec, signer: SignerDep
) -> ResponderResponse:
    issuer = signer.issuers.get(issuer_id)
    return ResponderResponse.of(
        signer.responders.issue(
            responder_request(body),
            issuer.certificate,
            signer.keys.private_key(issuer.key_id),
            ONLINE_RESPONDER_MAX_DAYS,
        )
    )


@router.post(
    "/ceremonies/{ceremony_id}/ocsp-responders",
    summary="Issues an offline CA's OCSP responder in a ceremony",
    description="The same, signed by the ceremony's CA, valid at most 400 "
    "days: an offline CA's responses are signed by this responder while the "
    "CA's own key stays offline.",
    status_code=status.HTTP_201_CREATED,
    responses=errors(400, 404, 409, 422, 503),
)
def issue_ceremony_ocsp_responder(
    ceremony_id: str, body: ResponderSpec, signer: SignerDep
) -> ResponderResponse:
    return ResponderResponse.of(
        signer.ceremonies.issue_ocsp_responder(
            ceremony_id, signer.responders, responder_request(body)
        )
    )


@router.get(
    "/ocsp-responders/{key_id}",
    summary="Describes an OCSP responder",
    description="Its certificate and the CA it answers for.",
    responses=errors(404),
)
def describe_ocsp_responder(key_id: str, signer: SignerDep) -> ResponderResponse:
    return ResponderResponse.of(signer.responders.get(key_id))


@router.post(
    "/ocsp-responders/{key_id}/responses",
    summary="Signs OCSP responses",
    description="One response per entry, each for a serial of the "
    "responder's own CA (the CertID's issuer hashes are the signer's, from "
    "the CA's certificate): good or revoked, with this thisUpdate and "
    "nextUpdate, at most a week apart and within the responder's validity.",
    responses=errors(400, 404, 422, 503),
)
def sign_ocsp_responses(
    key_id: str, body: OcspResponsesRequest, signer: SignerDep
) -> OcspResponsesResponse:
    responses = signer.responders.sign(
        key_id, body.this_update, body.next_update, ocsp_entries(body)
    )
    return OcspResponsesResponse(
        responses=[base64.b64encode(r).decode("ascii") for r in responses]
    )
