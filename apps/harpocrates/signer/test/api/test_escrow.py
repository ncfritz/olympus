import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from fastapi.testclient import TestClient

from test.conftest import SERVER_AUTH, Hierarchy, load, ok, spec


def issue_generated(client: TestClient, hierarchy: Hierarchy) -> tuple[str, str]:
    key = ok(client.post("/v1/keys", json={"purpose": "subject"}))
    certificate = ok(
        client.post(
            f"/v1/issuers/{hierarchy.issuer_id}/certificates",
            json=spec(
                "CN=printer.internal.localhost",
                days=90,
                keyId=key["id"],
                extendedKeyUsages=[SERVER_AUTH],
                sans={"dns": ["printer.internal.localhost"]},
            ),
        )
    )["certificate"]
    return key["id"], certificate


def export(client: TestClient, key_id: str, **body) -> bytes:
    response = ok(
        client.post(
            f"/v1/keys/{key_id}/export", json={"passphrase": "export me", **body}
        ),
        200,
    )
    return base64.b64decode(response["data"])


def test_exports_modern_pkcs12_with_the_chain(
    unsealed: TestClient, hierarchy: Hierarchy
):
    key_id, certificate = issue_generated(unsealed, hierarchy)
    data = export(
        unsealed,
        key_id,
        format="pkcs12",
        certificate=certificate,
        chain=[hierarchy.issuing, hierarchy.intermediate],
    )
    bundle = pkcs12.load_pkcs12(data, b"export me")
    assert bundle.cert is not None and bundle.cert.certificate == load(certificate)
    assert len(bundle.additional_certs) == 2


def test_exports_legacy_pkcs12_without_the_chain(
    unsealed: TestClient, hierarchy: Hierarchy
):
    key_id, certificate = issue_generated(unsealed, hierarchy)
    data = export(
        unsealed,
        key_id,
        format="pkcs12-legacy",
        certificate=certificate,
        chain=[hierarchy.issuing],
    )
    bundle = pkcs12.load_pkcs12(data, b"export me")
    assert bundle.additional_certs == []


def test_exports_encrypted_pem(unsealed: TestClient, hierarchy: Hierarchy):
    key_id, _ = issue_generated(unsealed, hierarchy)
    data = export(unsealed, key_id, format="pem")
    assert b"ENCRYPTED PRIVATE KEY" in data
    serialization.load_pem_private_key(data, b"export me")


def test_never_exports_an_issuers_key(unsealed: TestClient, hierarchy: Hierarchy):
    issuer = ok(unsealed.get(f"/v1/issuers/{hierarchy.issuer_id}"), 200)
    response = unsealed.post(
        f"/v1/keys/{issuer['keyId']}/export",
        json={"format": "pem", "passphrase": "export me"},
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "escrow"


def test_refuses_a_certificate_for_another_key(
    unsealed: TestClient, hierarchy: Hierarchy
):
    key_id, _ = issue_generated(unsealed, hierarchy)
    _, other = issue_generated(unsealed, hierarchy)
    response = unsealed.post(
        f"/v1/keys/{key_id}/export",
        json={"format": "pkcs12", "passphrase": "export me", "certificate": other},
    )
    assert response.status_code == 422
