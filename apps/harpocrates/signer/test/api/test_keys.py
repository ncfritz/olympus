import base64
import datetime

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import dsa, ec, ed25519
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient

from harpocrates_signer.keys import KeyAlgorithm, algorithm_of
from test.conftest import SERVER_AUTH, Hierarchy, load, ok, spec

NAME = "keys.internal.localhost"

# RSA-8192 is generated too, but slowly: its own test, below.
QUICK = [a for a in KeyAlgorithm if a is not KeyAlgorithm.RSA8192]


def issue(client: TestClient, hierarchy: Hierarchy, **key) -> x509.Certificate:
    return load(
        ok(
            client.post(
                f"/v1/issuers/{hierarchy.issuer_id}/certificates",
                json=spec(
                    f"CN={NAME}",
                    days=90,
                    extendedKeyUsages=[SERVER_AUTH],
                    sans={"dns": [NAME]},
                    **key,
                ),
            )
        )["certificate"]
    )


def generate_and_certify(
    client: TestClient, hierarchy: Hierarchy, algorithm: KeyAlgorithm
) -> None:
    key = ok(
        client.post(
            "/v1/keys", json={"purpose": "subject", "algorithm": algorithm.value}
        )
    )
    assert key["algorithm"] == algorithm.value
    certificate = issue(client, hierarchy, keyId=key["id"])
    assert algorithm_of(certificate.public_key()) == algorithm.value  # type: ignore[arg-type]
    # Escrowed, it exports as PKCS#12 whatever its type.
    response = ok(
        client.post(
            f"/v1/keys/{key['id']}/export",
            json={
                "format": "pkcs12",
                "passphrase": "export me",
                "certificate": certificate.public_bytes(
                    serialization.Encoding.PEM
                ).decode(),
            },
        ),
        200,
    )
    bundle = pkcs12.load_pkcs12(base64.b64decode(response["data"]), b"export me")
    assert bundle.key is not None
    assert algorithm_of(bundle.key) == algorithm.value  # type: ignore[arg-type]


@pytest.mark.parametrize("algorithm", QUICK, ids=lambda a: a.value)
def test_generates_and_certifies_each_algorithm(
    unsealed: TestClient, hierarchy: Hierarchy, algorithm: KeyAlgorithm
):
    generate_and_certify(unsealed, hierarchy, algorithm)


def test_generates_rsa_8192(unsealed: TestClient, hierarchy: Hierarchy):
    generate_and_certify(unsealed, hierarchy, KeyAlgorithm.RSA8192)


def self_signed(key: dsa.DSAPrivateKey | ec.EllipticCurvePrivateKey):
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, NAME)])
    now = datetime.datetime.now(datetime.UTC)
    return (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=1))
        .sign(key, hashes.SHA256())
    )


def p12(key, passphrase: bytes) -> str:
    data = pkcs12.serialize_key_and_certificates(
        b"brought",
        key,
        self_signed(key),
        None,
        serialization.BestAvailableEncryption(passphrase),
    )
    return base64.b64encode(data).decode()


def test_imports_the_key_in_a_pkcs12_file(unsealed: TestClient, hierarchy: Hierarchy):
    key = dsa.generate_private_key(key_size=2048)
    imported = ok(
        unsealed.post(
            "/v1/keys/import",
            json={
                "purpose": "subject",
                "privateKey": p12(key, b"bring me"),
                "passphrase": "bring me",
                "format": "pkcs12",
            },
        )
    )
    assert imported["algorithm"] == "DSA-2048"
    certificate = issue(unsealed, hierarchy, keyId=imported["id"])
    assert certificate.public_key() == key.public_key()


def test_imports_encrypted_pkcs8_for_a_subject(unsealed: TestClient):
    key = ed25519.Ed25519PrivateKey.generate()
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(b"bring me"),
    ).decode()
    imported = ok(
        unsealed.post(
            "/v1/keys/import",
            json={"purpose": "subject", "privateKey": pem, "passphrase": "bring me"},
        )
    )
    assert imported["algorithm"] == "Ed25519"


@pytest.mark.parametrize(
    ("data", "detail"),
    [
        ("not base64!", "not base64"),
        (base64.b64encode(b"nonsense").decode(), "not PKCS#12"),
    ],
)
def test_refuses_what_is_not_pkcs12(unsealed: TestClient, data: str, detail: str):
    response = unsealed.post(
        "/v1/keys/import",
        json={
            "purpose": "subject",
            "privateKey": data,
            "passphrase": "bring me",
            "format": "pkcs12",
        },
    )
    assert response.status_code == 400
    assert detail in response.text


def test_refuses_the_wrong_pkcs12_passphrase(unsealed: TestClient):
    data = p12(ec.generate_private_key(ec.SECP384R1()), b"bring me")
    response = unsealed.post(
        "/v1/keys/import",
        json={
            "purpose": "subject",
            "privateKey": data,
            "passphrase": "not it",
            "format": "pkcs12",
        },
    )
    assert response.status_code == 400


def test_refuses_a_short_dsa_key(unsealed: TestClient):
    data = p12(dsa.generate_private_key(key_size=1024), b"bring me")
    response = unsealed.post(
        "/v1/keys/import",
        json={
            "purpose": "subject",
            "privateKey": data,
            "passphrase": "bring me",
            "format": "pkcs12",
        },
    )
    assert response.status_code == 400
    assert "at least 2048" in response.text


def test_certifies_a_dsa_csr(unsealed: TestClient, hierarchy: Hierarchy):
    key = dsa.generate_private_key(key_size=2048)
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, NAME)]))
        .sign(key, hashes.SHA256())
        .public_bytes(serialization.Encoding.PEM)
        .decode()
    )
    certificate = issue(unsealed, hierarchy, csr=csr)
    assert certificate.public_key() == key.public_key()
