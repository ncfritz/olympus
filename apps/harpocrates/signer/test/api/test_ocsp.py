"""OCSP (ADR 0036): each CA's delegated responder, and the responses it
signs, checked by `openssl ocsp` as a client would check them."""

import base64
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import Encoding
from cryptography.x509 import ocsp
from cryptography.x509.oid import AuthorityInformationAccessOID, ExtendedKeyUsageOID
from fastapi.testclient import TestClient

from test.api.test_signing import refused, server_spec, sign
from test.conftest import EXPORT_PASSPHRASE, Hierarchy, load, ok, serial

OCSP_URL = "http://pki.internal.localhost/ocsp"


def openssl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["openssl", *args], capture_output=True, text=True)


def responder_spec(key_id: str, *, days: int = 30, **fields: Any) -> dict[str, Any]:
    start = datetime.now(UTC) - timedelta(minutes=5)
    return {
        "subject": "CN=Test TLS Issuing CA 1 - G1 OCSP,O=Olympus Test",
        "serial": serial(),
        "notBefore": start.isoformat(),
        "notAfter": (start + timedelta(days=days)).isoformat(),
        "keyId": key_id,
        **fields,
    }


def ocsp_key(client: TestClient) -> str:
    return ok(client.post("/v1/keys", json={"purpose": "ocsp"}))["id"]


def online_responder(client: TestClient, hierarchy: Hierarchy) -> dict[str, Any]:
    return ok(
        client.post(
            f"/v1/issuers/{hierarchy.issuer_id}/ocsp-responders",
            json=responder_spec(ocsp_key(client)),
        )
    )


def window(**delta: float) -> dict[str, str]:
    now = datetime.now(UTC)
    return {
        "thisUpdate": now.isoformat(),
        "nextUpdate": (now + timedelta(**delta or {"days": 4})).isoformat(),
    }


def responses(
    client: TestClient, key_id: str, entries: list[dict[str, Any]], **delta: float
):
    return client.post(
        f"/v1/ocsp-responders/{key_id}/responses",
        json={**window(**delta), "entries": entries},
    )


def leaf(client: TestClient, hierarchy: Hierarchy) -> x509.Certificate:
    key = ok(client.post("/v1/keys", json={"purpose": "subject"}))
    return load(
        ok(sign(client, hierarchy, server_spec(["localhost"], keyId=key["id"])))[
            "certificate"
        ]
    )


def hex_serial(certificate: x509.Certificate) -> str:
    return format(certificate.serial_number, "x")


# ---- responders


def test_an_ocsp_key_is_p256_generated_here_and_never_a_subjects(
    unsealed: TestClient, hierarchy: Hierarchy
):
    refused(
        unsealed.post("/v1/keys", json={"purpose": "ocsp", "algorithm": "Ed25519"}),
        "ocsp-key",
    )
    key = ok(unsealed.post("/v1/keys", json={"purpose": "ocsp"}))
    assert key["algorithm"] == "P-256"
    refused(
        sign(unsealed, hierarchy, server_spec(["localhost"], keyId=key["id"])),
        "subject-key",
    )


def test_an_online_issuer_issues_its_responder(
    unsealed: TestClient, hierarchy: Hierarchy
):
    responder = online_responder(unsealed, hierarchy)
    certificate = load(responder["certificate"])
    issuing = load(hierarchy.issuing)
    certificate.verify_directly_issued_by(issuing)
    assert load(responder["caCertificate"]) == issuing
    extensions = certificate.extensions
    assert extensions.get_extension_for_class(x509.ExtendedKeyUsage).value == (
        x509.ExtendedKeyUsage([ExtendedKeyUsageOID.OCSP_SIGNING])
    )
    usage = extensions.get_extension_for_class(x509.KeyUsage)
    assert usage.critical and usage.value.digital_signature
    assert not usage.value.key_cert_sign
    extensions.get_extension_for_class(x509.OCSPNoCheck)
    assert not extensions.get_extension_for_class(x509.BasicConstraints).value.ca
    for absent in (x509.CRLDistributionPoints, x509.AuthorityInformationAccess):
        try:
            extensions.get_extension_for_class(absent)
            raise AssertionError(f"{absent.__name__} should be absent")
        except x509.ExtensionNotFound:
            pass
    assert (
        ok(unsealed.get(f"/v1/ocsp-responders/{responder['keyId']}"), 200)[
            "certificate"
        ]
        == responder["certificate"]
    )


def test_a_responder_is_refused_past_its_rules(
    unsealed: TestClient, hierarchy: Hierarchy
):
    issue = f"/v1/issuers/{hierarchy.issuer_id}/ocsp-responders"
    refused(
        unsealed.post(issue, json=responder_spec(ocsp_key(unsealed), days=36)),
        "ocsp-responder",
    )
    subject = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    refused(unsealed.post(issue, json=responder_spec(subject["id"])), "ocsp-key")
    key = ocsp_key(unsealed)
    ok(unsealed.post(issue, json=responder_spec(key)))
    assert unsealed.post(issue, json=responder_spec(key)).status_code == 409


# ---- responses


def test_responses_verify_with_openssl_good_and_revoked(
    tmp_path: Path, unsealed: TestClient, hierarchy: Hierarchy
):
    responder = online_responder(unsealed, hierarchy)
    good, revoked = leaf(unsealed, hierarchy), leaf(unsealed, hierarchy)
    revoked_at = datetime.now(UTC) - timedelta(minutes=1)
    signed = ok(
        responses(
            unsealed,
            responder["keyId"],
            [
                {"serial": hex_serial(good), "status": "good"},
                {
                    "serial": hex_serial(revoked),
                    "hash": "sha256",
                    "status": "revoked",
                    "revokedAt": revoked_at.isoformat(),
                    "reason": "keyCompromise",
                },
            ],
        ),
        200,
    )["responses"]
    assert len(signed) == 2

    (tmp_path / "chain.pem").write_text(
        hierarchy.root + hierarchy.intermediate + hierarchy.issuing
    )
    (tmp_path / "issuer.pem").write_text(hierarchy.issuing)
    for name, certificate, response, expected in (
        ("good", good, signed[0], "good"),
        ("revoked", revoked, signed[1], "revoked"),
    ):
        (tmp_path / f"{name}.der").write_bytes(base64.b64decode(response))
        (tmp_path / f"{name}.pem").write_bytes(certificate.public_bytes(Encoding.PEM))
        # The digest names the CertID's hash, and comes before -cert.
        checked = openssl(
            "ocsp",
            "-respin",
            str(tmp_path / f"{name}.der"),
            "-issuer",
            str(tmp_path / "issuer.pem"),
            *(["-sha256"] if name == "revoked" else []),
            "-cert",
            str(tmp_path / f"{name}.pem"),
            "-CAfile",
            str(tmp_path / "chain.pem"),
        )
        assert "Response verify OK" in checked.stderr, checked.stderr
        assert f"{name}.pem: {expected}" in checked.stdout, checked.stdout

    parsed = ocsp.load_der_ocsp_response(base64.b64decode(signed[1]))
    assert parsed.certificate_status is ocsp.OCSPCertStatus.REVOKED
    assert parsed.revocation_reason is x509.ReasonFlags.key_compromise
    assert parsed.next_update_utc is not None
    assert parsed.next_update_utc - parsed.this_update_utc == timedelta(days=4)
    # The CertID is the one a client builds for that certificate.
    request = (
        ocsp.OCSPRequestBuilder()
        .add_certificate(revoked, load(hierarchy.issuing), hashes.SHA256())
        .build()
    )
    assert parsed.issuer_key_hash == request.issuer_key_hash
    assert parsed.issuer_name_hash == request.issuer_name_hash
    assert parsed.serial_number == revoked.serial_number


def test_responses_are_refused_outside_their_window(
    unsealed: TestClient, hierarchy: Hierarchy
):
    key_id = online_responder(unsealed, hierarchy)["keyId"]
    entry = {"serial": "1234", "status": "good"}
    refused(responses(unsealed, key_id, [entry], days=8), "ocsp-window")
    # Past the responder's own expiry.
    short = ok(
        unsealed.post(
            f"/v1/issuers/{hierarchy.issuer_id}/ocsp-responders",
            json=responder_spec(ocsp_key(unsealed), days=2),
        )
    )["keyId"]
    refused(responses(unsealed, short, [entry], days=4), "ocsp-window")
    future = datetime.now(UTC) + timedelta(hours=1)
    refused(
        unsealed.post(
            f"/v1/ocsp-responders/{key_id}/responses",
            json={
                "thisUpdate": future.isoformat(),
                "nextUpdate": (future + timedelta(days=1)).isoformat(),
                "entries": [entry],
            },
        ),
        "ocsp-window",
    )
    later = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    refused(
        responses(
            unsealed,
            key_id,
            [{"serial": "1234", "status": "revoked", "revokedAt": later}],
        ),
        "ocsp-window",
    )
    assert (
        responses(
            unsealed,
            key_id,
            [{"serial": "1234", "status": "good", "reason": "superseded"}],
        ).status_code
        == 400
    )
    assert responses(unsealed, key_id, []).status_code == 400
    assert responses(unsealed, "no-such-key", [entry]).status_code == 404


def test_an_offline_ca_issues_its_responder_in_a_ceremony(
    tmp_path: Path, unsealed: TestClient, hierarchy: Hierarchy
):
    ceremony = ok(
        unsealed.post(
            "/v1/ceremonies",
            json={
                "privateKey": hierarchy.intermediate_key,
                "passphrase": EXPORT_PASSPHRASE,
                "certificate": hierarchy.intermediate,
            },
        )
    )
    issue = f"/v1/ceremonies/{ceremony['id']}/ocsp-responders"
    refused(
        unsealed.post(issue, json=responder_spec(ocsp_key(unsealed), days=401)),
        "ocsp-responder",
    )
    responder = ok(
        unsealed.post(issue, json=responder_spec(ocsp_key(unsealed), days=396))
    )
    ok(unsealed.delete(f"/v1/ceremonies/{ceremony['id']}"), 204)
    load(responder["certificate"]).verify_directly_issued_by(
        load(hierarchy.intermediate)
    )

    # The ceremony is over: the responder still answers for the issuing CA.
    issuing = load(hierarchy.issuing)
    signed = ok(
        responses(
            unsealed,
            responder["keyId"],
            [{"serial": hex_serial(issuing), "status": "good"}],
        ),
        200,
    )["responses"][0]
    (tmp_path / "chain.pem").write_text(hierarchy.root + hierarchy.intermediate)
    (tmp_path / "issuer.pem").write_text(hierarchy.intermediate)
    (tmp_path / "issuing.pem").write_text(hierarchy.issuing)
    (tmp_path / "r.der").write_bytes(base64.b64decode(signed))
    checked = openssl(
        "ocsp",
        "-respin",
        str(tmp_path / "r.der"),
        "-issuer",
        str(tmp_path / "issuer.pem"),
        "-cert",
        str(tmp_path / "issuing.pem"),
        "-CAfile",
        str(tmp_path / "chain.pem"),
    )
    assert "Response verify OK" in checked.stderr, checked.stderr
    assert "issuing.pem: good" in checked.stdout, checked.stdout


def test_a_sealed_signer_signs_no_responses(unsealed: TestClient, hierarchy: Hierarchy):
    key_id = online_responder(unsealed, hierarchy)["keyId"]
    ok(unsealed.post("/v1/seal"), 204)
    assert (
        responses(unsealed, key_id, [{"serial": "1234", "status": "good"}]).status_code
        == 503
    )


# ---- AIA OCSP and must-staple


def test_must_staple_needs_an_ocsp_url(unsealed: TestClient, hierarchy: Hierarchy):
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    refused(
        sign(
            unsealed,
            hierarchy,
            server_spec(["localhost"], keyId=key["id"], mustStaple=True),
        ),
        "tls-feature",
    )
    refused(
        sign(
            unsealed,
            hierarchy,
            server_spec(["localhost"], keyId=key["id"], ocspUrls=["https://pki/ocsp"]),
        ),
        "ocsp-url",
    )
    certificate = load(
        ok(
            sign(
                unsealed,
                hierarchy,
                server_spec(
                    ["localhost"], keyId=key["id"], ocspUrls=[OCSP_URL], mustStaple=True
                ),
            )
        )["certificate"]
    )
    feature = certificate.extensions.get_extension_for_class(x509.TLSFeature)
    assert list(feature.value) == [x509.TLSFeatureType.status_request]
    access = certificate.extensions.get_extension_for_class(
        x509.AuthorityInformationAccess
    ).value
    assert [(a.access_method, a.access_location.value) for a in access] == [
        (AuthorityInformationAccessOID.OCSP, OCSP_URL),
        (
            AuthorityInformationAccessOID.CA_ISSUERS,
            "http://pki.internal.localhost/ca/tls-issuing-1-g1.crt",
        ),
    ]
