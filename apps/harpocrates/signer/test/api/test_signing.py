"""Certificates and lists from a hierarchy built through the API, each one
checked by openssl as a relying party would check it (plan, phase 1)."""

import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID
from fastapi.testclient import TestClient
from httpx2 import Response

from test.conftest import (
    CLIENT_AUTH,
    SERVER_AUTH,
    Hierarchy,
    csr_for,
    load,
    ok,
    serial,
    spec,
)


def openssl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["openssl", *args], capture_output=True, text=True)


def verify(
    tmp_path: Path, hierarchy: Hierarchy, leaf_pem: str
) -> subprocess.CompletedProcess[str]:
    (tmp_path / "root.pem").write_text(hierarchy.root)
    (tmp_path / "untrusted.pem").write_text(hierarchy.issuing + hierarchy.intermediate)
    (tmp_path / "leaf.pem").write_text(leaf_pem)
    return openssl(
        "verify",
        "-CAfile",
        str(tmp_path / "root.pem"),
        "-untrusted",
        str(tmp_path / "untrusted.pem"),
        "-purpose",
        "sslserver",
        str(tmp_path / "leaf.pem"),
    )


def server_spec(names: list[str], **fields):
    return spec(
        f"CN={names[0]}",
        days=90,
        keyUsage=["digital_signature"],
        extendedKeyUsages=[SERVER_AUTH],
        sans={"dns": names},
        crlDistributionPoints=[
            "http://pki.internal.localhost/crl/tls-issuing-1-g1.crl"
        ],
        issuerUrls=["http://pki.internal.localhost/ca/tls-issuing-1-g1.crt"],
        **fields,
    )


def sign(client: TestClient, hierarchy: Hierarchy, body) -> Response:
    return client.post(f"/v1/issuers/{hierarchy.issuer_id}/certificates", json=body)


def refused(response, invariant: str) -> None:
    assert response.status_code == 422, response.text
    assert response.json()["error"] == "refused"
    assert response.json()["invariant"] == invariant


# ---- the hierarchy


def test_the_hierarchy_verifies_with_openssl(tmp_path, hierarchy: Hierarchy):
    root, intermediate, issuing = (
        load(hierarchy.root),
        load(hierarchy.intermediate),
        load(hierarchy.issuing),
    )
    constraints = [
        c.extensions.get_extension_for_class(x509.BasicConstraints).value
        for c in (root, intermediate, issuing)
    ]
    assert [c.path_length for c in constraints] == [2, 1, 0]
    assert root.issuer == root.subject
    (tmp_path / "root.pem").write_text(hierarchy.root)
    (tmp_path / "chain.pem").write_text(hierarchy.intermediate)
    (tmp_path / "issuing.pem").write_text(hierarchy.issuing)
    result = openssl(
        "verify",
        "-CAfile",
        str(tmp_path / "root.pem"),
        "-untrusted",
        str(tmp_path / "chain.pem"),
        str(tmp_path / "issuing.pem"),
    )
    assert result.returncode == 0, result.stderr


def test_the_offline_keys_were_never_kept(unsealed: TestClient, hierarchy: Hierarchy):
    status = ok(unsealed.get("/v1/status"), 200)
    assert status["ceremony"] is None
    assert status["keys"] == 1  # the issuing CA's, and nothing of the offline CAs


# ---- leaf certificates


def test_signs_a_csr_and_openssl_verifies_it(tmp_path, unsealed, hierarchy):
    _, csr = csr_for(["nas.internal.localhost"])
    certificate = ok(
        sign(unsealed, hierarchy, server_spec(["nas.internal.localhost"], csr=csr))
    )
    leaf = load(certificate["certificate"])
    assert leaf.issuer == load(hierarchy.issuing).subject
    assert not leaf.extensions.get_extension_for_class(x509.BasicConstraints).value.ca
    assert leaf.extensions.get_extension_for_class(x509.SubjectKeyIdentifier)
    assert leaf.extensions.get_extension_for_class(x509.AuthorityKeyIdentifier)
    result = verify(tmp_path, hierarchy, certificate["certificate"])
    assert result.returncode == 0, result.stderr


def test_signs_a_generated_subject_key(unsealed, hierarchy):
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    certificate = ok(
        sign(unsealed, hierarchy, server_spec(["localhost"], keyId=key["id"]))
    )
    leaf = load(certificate["certificate"])
    assert (
        leaf.public_key()
        .public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )
        .decode()
        == key["publicKey"]
    )


def test_signs_an_rsa_key_for_the_printer(unsealed, hierarchy):
    key = ok(
        unsealed.post("/v1/keys", json={"purpose": "subject", "algorithm": "RSA-2048"})
    )
    assert key["algorithm"] == "RSA-2048"
    ok(
        sign(
            unsealed,
            hierarchy,
            server_spec(["printer.internal.localhost"], keyId=key["id"]),
        )
    )


def test_refuses_a_name_outside_the_constraints(tmp_path, unsealed, hierarchy):
    _, csr = csr_for(["nas.internal.localhost"])
    refused(
        sign(
            unsealed,
            hierarchy,
            server_spec(["nas.internal.localhost", "example.com"], csr=csr),
        ),
        "name-constraints",
    )


def test_refuses_a_usage_the_issuer_may_not_sign(unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    body = server_spec(["localhost"], csr=csr)
    body["extendedKeyUsages"] = [CLIENT_AUTH]
    refused(sign(unsealed, hierarchy, body), "extended-key-usage")


def test_refuses_longer_than_the_issuers_maximum(unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    body = server_spec(["localhost"], csr=csr)
    body["notAfter"] = (datetime.now(UTC) + timedelta(days=91)).isoformat()
    refused(sign(unsealed, hierarchy, body), "validity")


def test_refuses_a_ca_from_an_online_issuer(unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    refused(
        sign(
            unsealed,
            hierarchy,
            server_spec(["localhost"], csr=csr, ca=True, pathLength=0),
        ),
        "ca",
    )


def test_refuses_a_csr_whose_signature_does_not_verify(unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    other, _ = csr_for(["localhost"])
    forged = x509.load_pem_x509_csr(csr.encode()).public_bytes(
        serialization.Encoding.DER
    )
    # Flip a byte of the signature at the end.
    tampered = forged[:-1] + bytes([forged[-1] ^ 0x01])
    pem = (
        x509.load_der_x509_csr(tampered)
        .public_bytes(serialization.Encoding.PEM)
        .decode()
    )
    refused(
        sign(unsealed, hierarchy, server_spec(["localhost"], csr=pem)),
        "proof-of-possession",
    )
    assert other  # a second key, unused: only the signature is wrong


def test_refuses_an_issuers_key_as_a_subject_key(unsealed, hierarchy):
    issuer = ok(unsealed.get(f"/v1/issuers/{hierarchy.issuer_id}"), 200)
    refused(
        sign(unsealed, hierarchy, server_spec(["localhost"], keyId=issuer["keyId"])),
        "subject-key",
    )


def test_needs_exactly_one_subject_key(unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    assert (
        sign(
            unsealed, hierarchy, server_spec(["localhost"], csr=csr, keyId=key["id"])
        ).status_code
        == 400
    )
    assert sign(unsealed, hierarchy, server_spec(["localhost"])).status_code == 400


def test_registering_needs_the_issuers_own_key_and_path_length_0(unsealed, hierarchy):
    other = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    response = unsealed.post(
        "/v1/issuers",
        json={
            "id": "another",
            "keyId": other["id"],
            "certificate": hierarchy.issuing,
            "maxValidityDays": 90,
            "extendedKeyUsages": [SERVER_AUTH],
        },
    )
    refused(response, "issuer-key")


# ---- keys


def test_the_same_key_cannot_be_imported_twice(unsealed):
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(b"xca export"),
    ).decode()
    body = {"purpose": "issuer", "privateKey": pem, "passphrase": "xca export"}
    ok(unsealed.post("/v1/keys/import", json=body))
    assert unsealed.post("/v1/keys/import", json=body).status_code == 409
    wrong = {**body, "passphrase": "not it"}
    assert unsealed.post("/v1/keys/import", json=wrong).status_code == 400


def test_imports_the_dev_cas_keys():
    """scripts/dev-ca.sh writes the format the signer imports."""
    root = Path(__file__).parents[5]
    keys = root / "infra" / "dev-ca" / "certs" / "keys"
    if not keys.is_dir():
        pytest.skip("run scripts/dev-ca.sh first")
    from harpocrates_signer.keys import load_encrypted_pkcs8

    for path in keys.glob("*.p8"):
        load_encrypted_pkcs8(path.read_text(), "olympus")


def test_a_destroyed_key_is_gone(unsealed, hierarchy):
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    ok(unsealed.delete(f"/v1/keys/{key['id']}"), 204)
    assert ok(unsealed.get(f"/v1/keys/{key['id']}"), 200)["destroyed"]
    refused(
        sign(unsealed, hierarchy, server_spec(["localhost"], keyId=key["id"])),
        "subject-key",
    )
    issuer = ok(unsealed.get(f"/v1/issuers/{hierarchy.issuer_id}"), 200)
    assert unsealed.delete(f"/v1/keys/{issuer['keyId']}").status_code == 409


# ---- revocation lists


def test_signs_a_list_openssl_verifies(tmp_path, unsealed, hierarchy):
    now = datetime.now(UTC)
    body = {
        "number": 1001,
        "thisUpdate": now.isoformat(),
        "nextUpdate": (now + timedelta(days=7)).isoformat(),
        "revoked": [
            {
                "serial": serial(),
                "revokedAt": now.isoformat(),
                "reason": "keyCompromise",
            },
            {"serial": serial(), "revokedAt": now.isoformat()},
        ],
    }
    crl = ok(unsealed.post(f"/v1/issuers/{hierarchy.issuer_id}/crls", json=body))["crl"]
    parsed = x509.load_pem_x509_crl(crl.encode())
    assert (
        parsed.extensions.get_extension_for_class(x509.CRLNumber).value.crl_number
        == 1001
    )
    assert len(list(parsed)) == 2
    (tmp_path / "crl.pem").write_text(crl)
    (tmp_path / "issuer.pem").write_text(hierarchy.issuing)
    result = openssl(
        "crl",
        "-in",
        str(tmp_path / "crl.pem"),
        "-CAfile",
        str(tmp_path / "issuer.pem"),
        "-noout",
        "-verify",
    )
    assert result.returncode == 0 and "verify OK" in (result.stdout + result.stderr), (
        result.stderr
    )


def test_refuses_a_list_past_the_issuers_expiry(unsealed, hierarchy):
    now = datetime.now(UTC)
    response = unsealed.post(
        f"/v1/issuers/{hierarchy.issuer_id}/crls",
        json={
            "number": 1,
            "thisUpdate": now.isoformat(),
            "nextUpdate": (now + timedelta(days=4000)).isoformat(),
        },
    )
    refused(response, "validity")


def test_a_revoked_leaf_fails_openssls_check(tmp_path, unsealed, hierarchy):
    _, csr = csr_for(["localhost"])
    leaf = ok(sign(unsealed, hierarchy, server_spec(["localhost"], csr=csr)))[
        "certificate"
    ]
    now = datetime.now(UTC)
    crl = ok(
        unsealed.post(
            f"/v1/issuers/{hierarchy.issuer_id}/crls",
            json={
                "number": 2,
                "thisUpdate": now.isoformat(),
                "nextUpdate": (now + timedelta(days=7)).isoformat(),
                "revoked": [
                    {
                        "serial": format(load(leaf).serial_number, "x"),
                        "revokedAt": now.isoformat(),
                    }
                ],
            },
        )
    )["crl"]
    (tmp_path / "root.pem").write_text(hierarchy.root)
    (tmp_path / "untrusted.pem").write_text(hierarchy.issuing + hierarchy.intermediate)
    (tmp_path / "leaf.pem").write_text(leaf)
    (tmp_path / "crl.pem").write_text(crl)
    result = openssl(
        "verify",
        "-crl_check",
        "-CAfile",
        str(tmp_path / "root.pem"),
        "-untrusted",
        str(tmp_path / "untrusted.pem"),
        "-CRLfile",
        str(tmp_path / "crl.pem"),
        str(tmp_path / "leaf.pem"),
    )
    assert result.returncode != 0
    assert "revoked" in (result.stdout + result.stderr)


def test_eku_constants_match_cryptography():
    assert ExtendedKeyUsageOID.SERVER_AUTH.dotted_string == SERVER_AUTH


def test_registering_checks_the_chain_is_the_issuers_own(unsealed, hierarchy):
    issuer = ok(unsealed.get(f"/v1/issuers/{hierarchy.issuer_id}"), 200)
    response = unsealed.post(
        "/v1/issuers",
        json={
            "id": "wrong-chain",
            "keyId": issuer["keyId"],
            "certificate": hierarchy.issuing,
            "chain": [hierarchy.root],
            "maxValidityDays": 90,
            "extendedKeyUsages": [SERVER_AUTH],
        },
    )
    refused(response, "chain")
