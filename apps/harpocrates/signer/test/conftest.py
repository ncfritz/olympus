"""Fixtures: a signer on a temporary store, and a hierarchy built through
its API the way the service and a ceremony would build it."""

import secrets
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from harpocrates_signer.app import create_app
from harpocrates_signer.config import Config

PASSPHRASE = "correct horse battery staple"
EXPORT_PASSPHRASE = "offline media passphrase"
SERVER_AUTH = "1.3.6.1.5.5.7.3.1"
CLIENT_AUTH = "1.3.6.1.5.5.7.3.2"
CODE_SIGNING = "1.3.6.1.5.5.7.3.3"


@pytest.fixture
def short_dir() -> Iterator[Path]:
    """A directory under /tmp: an AF_UNIX path is at most 104 bytes on
    macOS, and pytest's tmp_path is longer."""
    path = Path(f"/tmp/harpocrates-test-{time.monotonic_ns()}")
    path.mkdir()
    yield path
    for child in sorted(path.rglob("*"), reverse=True):
        child.unlink() if not child.is_dir() else child.rmdir()
    path.rmdir()


@pytest.fixture
def config(short_dir: Path) -> Config:
    token_file = short_dir / "token"
    token_file.write_text(secrets.token_urlsafe(32))
    return Config(
        socket_path=short_dir / "signer.sock",
        store_path=short_dir / "store" / "signer.db",
        token_file=token_file,
        unseal_key_file=short_dir / "unseal-key",
        ceremony_timeout=timedelta(minutes=5),
        log_level="ERROR",
    )


def open_client(config: Config) -> TestClient:
    client = TestClient(create_app(config))
    client.headers["Authorization"] = f"Bearer {config.token_file.read_text()}"
    return client


@pytest.fixture
def client(config: Config) -> Iterator[TestClient]:
    """An uninitialised signer."""
    with open_client(config) as client:
        yield client


@pytest.fixture
def unsealed(config: Config, client: TestClient) -> TestClient:
    """Initialised, with the unseal key written where the config expects it."""
    response = client.post("/v1/initialise", json={"passphrase": PASSPHRASE})
    assert response.status_code == 201, response.text
    assert config.unseal_key_file is not None
    config.unseal_key_file.write_text(response.json()["unsealKey"])
    return client


def ok(response: Any, status: int = 201) -> dict[str, Any]:
    assert response.status_code == status, response.text
    return {} if status == 204 else response.json()


def serial() -> str:
    return secrets.token_hex(19)


def spec(
    subject: str,
    *,
    days: int = 365,
    start: datetime | None = None,
    **fields: Any,
) -> dict[str, Any]:
    """A certificate spec as the service sends one."""
    not_before = start or datetime.now(UTC) - timedelta(minutes=5)
    return {
        "subject": subject,
        "serial": serial(),
        "notBefore": not_before.isoformat(),
        "notAfter": (not_before + timedelta(days=days)).isoformat(),
        "keyUsage": ["digital_signature"],
        **fields,
    }


def ca_spec(
    subject: str, path_length: int, *, days: int, **fields: Any
) -> dict[str, Any]:
    return spec(
        subject,
        days=days,
        keyUsage=["key_cert_sign", "crl_sign"],
        ca=True,
        pathLength=path_length,
        **fields,
    )


def load(pem: str) -> x509.Certificate:
    return x509.load_pem_x509_certificate(pem.encode())


def csr_for(names: list[str]) -> tuple[ec.EllipticCurvePrivateKey, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(
            x509.Name([x509.NameAttribute(x509.NameOID.COMMON_NAME, names[0])])
        )
        .sign(key, hashes.SHA256())
    )
    return key, csr.public_bytes(serialization.Encoding.PEM).decode()


@dataclass
class Hierarchy:
    """Root and intermediate offline; the TLS issuing CA registered online."""

    root: str
    root_key: str
    intermediate: str
    intermediate_key: str
    issuing: str
    issuer_id: str

    def chain_file(self, path: Path) -> Path:
        path.write_text(self.issuing + self.intermediate)
        return path


def build_hierarchy(client: TestClient) -> Hierarchy:
    """What phase 2's CA wizard does, step by step, through the signer."""
    root = ok(
        client.post(
            "/v1/roots",
            json={
                "certificate": ca_spec(
                    "CN=Test Root CA 1,O=Olympus Test", 2, days=7300
                ),
                "exportPassphrase": EXPORT_PASSPHRASE,
            },
        )
    )
    ceremony = ok(
        client.post(
            "/v1/ceremonies",
            json={
                "privateKey": root["encryptedKey"],
                "passphrase": EXPORT_PASSPHRASE,
                "certificate": root["certificate"],
            },
        )
    )
    intermediate = ok(
        client.post(
            f"/v1/ceremonies/{ceremony['id']}/cas",
            json={
                "certificate": ca_spec(
                    "CN=Test Intermediate CA 1,O=Olympus Test", 1, days=3650
                ),
                "exportPassphrase": EXPORT_PASSPHRASE,
            },
        )
    )
    ok(client.delete(f"/v1/ceremonies/{ceremony['id']}"), 204)

    ceremony = ok(
        client.post(
            "/v1/ceremonies",
            json={
                "privateKey": intermediate["encryptedKey"],
                "passphrase": EXPORT_PASSPHRASE,
                "certificate": intermediate["certificate"],
            },
        )
    )
    issuer_key = ok(client.post("/v1/keys", json={"purpose": "issuer"}))
    issuing = ok(
        client.post(
            f"/v1/ceremonies/{ceremony['id']}/certificates",
            json=ca_spec(
                "CN=Test TLS Issuing CA 1 - G1,O=Olympus Test",
                0,
                days=1825,
                keyId=issuer_key["id"],
                extendedKeyUsages=[SERVER_AUTH],
                nameConstraints={
                    "permitted": {"dns": ["localhost", "internal.localhost"]}
                },
            ),
        )
    )
    ok(client.delete(f"/v1/ceremonies/{ceremony['id']}"), 204)

    ok(
        client.post(
            "/v1/issuers",
            json={
                "id": "tls-issuing-1-g1",
                "keyId": issuer_key["id"],
                "certificate": issuing["certificate"],
                "chain": [intermediate["certificate"], root["certificate"]],
                "maxValidityDays": 90,
                "extendedKeyUsages": [SERVER_AUTH],
            },
        )
    )
    return Hierarchy(
        root=root["certificate"],
        root_key=root["encryptedKey"],
        intermediate=intermediate["certificate"],
        intermediate_key=intermediate["encryptedKey"],
        issuing=issuing["certificate"],
        issuer_id="tls-issuing-1-g1",
    )


@pytest.fixture
def hierarchy(unsealed: TestClient) -> Hierarchy:
    return build_hierarchy(unsealed)
