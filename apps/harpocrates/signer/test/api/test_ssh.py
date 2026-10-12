"""SSH CAs and certificates (ADR 0035): registered, signed, and refused
where an invariant says, each certificate read back by ssh-keygen as a
host or a client would read it."""

import shutil
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    load_pem_public_key,
    load_ssh_public_identity,
)
from fastapi.testclient import TestClient

from test.api.test_signing import refused
from test.conftest import ok

DAY = 24 * 3600


def openssh(key) -> str:
    return key.public_bytes(Encoding.OpenSSH, PublicFormat.OpenSSH).decode()


def ed25519_key() -> str:
    return openssh(ed25519.Ed25519PrivateKey.generate().public_key())


def register(client: TestClient, ca_id: str, kind: str, days: int) -> dict:
    key = ok(
        client.post("/v1/keys", json={"purpose": "issuer", "algorithm": "Ed25519"})
    )
    return ok(
        client.post(
            "/v1/ssh/cas",
            json={
                "id": ca_id,
                "keyId": key["id"],
                "kind": kind,
                "maxValiditySeconds": days * DAY,
            },
        )
    )


@pytest.fixture
def cas(unsealed: TestClient) -> dict[str, dict]:
    return {
        "user": register(unsealed, "ssh-user-1-g1", "user", 7),
        "host": register(unsealed, "ssh-host-1-g1", "host", 365),
    }


def spec(kind: str = "user", hours: int = 16, **fields) -> dict:
    after = datetime.now(UTC) - timedelta(minutes=5)
    return {
        "kind": kind,
        "publicKey": ed25519_key(),
        "serial": "1f2e3d4c5b6a7980",
        "keyId": "neil@ncfritz.net:1f2e3d4c5b6a7980",
        "principals": (
            ["ncfritz", "admin"] if kind == "user" else ["mini.internal.ncfritz.net"]
        ),
        "validAfter": after.isoformat(),
        "validBefore": (after + timedelta(hours=hours)).isoformat(),
        **fields,
    }


def sign(client: TestClient, ca_id: str, body: dict):
    return client.post(f"/v1/ssh/cas/{ca_id}/certificates", json=body)


def keygen_listing(tmp_path: Path, certificate: str) -> str:
    if shutil.which("ssh-keygen") is None:
        pytest.skip("ssh-keygen is not installed")
    path = tmp_path / "id-cert.pub"
    path.write_text(certificate)
    result = subprocess.run(
        ["ssh-keygen", "-L", "-f", str(path)], capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


def test_registers_and_describes_the_cas(unsealed, cas):
    described = ok(unsealed.get("/v1/ssh/cas/ssh-user-1-g1"), 200)
    assert described == cas["user"]
    assert described["publicKey"].startswith("ssh-ed25519 ")
    assert cas["user"]["publicKey"] != cas["host"]["publicKey"]


def test_signs_a_user_certificate(tmp_path, unsealed, cas):
    body = spec(
        sourceAddresses=["192.168.15.0/24"],
        extensions=["permit-pty", "permit-port-forwarding"],
    )
    certificate = ok(sign(unsealed, "ssh-user-1-g1", body))["certificate"]
    parsed = load_ssh_public_identity(certificate.encode())
    parsed.verify_cert_signature()  # type: ignore[union-attr]
    assert openssh(parsed.signature_key()) == cas["user"]["publicKey"]  # type: ignore[union-attr]
    assert parsed.valid_principals == [b"ncfritz", b"admin"]  # type: ignore[union-attr]
    listing = keygen_listing(tmp_path, certificate)
    assert "user certificate" in listing
    assert 'Key ID: "neil@ncfritz.net:1f2e3d4c5b6a7980"' in listing
    assert "Serial: 2246800662264969600" in listing
    assert "source-address 192.168.15.0/24" in listing
    assert "permit-pty" in listing and "permit-port-forwarding" in listing
    assert "permit-agent-forwarding" not in listing


def test_signs_a_host_certificate(tmp_path, unsealed, cas):
    certificate = ok(sign(unsealed, "ssh-host-1-g1", spec("host", hours=90 * 24)))[
        "certificate"
    ]
    listing = keygen_listing(tmp_path, certificate)
    assert "host certificate" in listing
    assert "mini.internal.ncfritz.net" in listing


def test_a_ca_signs_only_its_own_kind(unsealed, cas):
    refused(sign(unsealed, "ssh-host-1-g1", spec("user")), "ssh-kind")
    refused(sign(unsealed, "ssh-user-1-g1", spec("host")), "ssh-kind")


def test_within_the_cas_maximum_validity(unsealed, cas):
    refused(sign(unsealed, "ssh-user-1-g1", spec(hours=8 * 24)), "validity")
    refused(sign(unsealed, "ssh-user-1-g1", spec(hours=-1)), "validity")


def test_principals_are_named(unsealed, cas):
    refused(sign(unsealed, "ssh-user-1-g1", spec(principals=[])), "principals")
    refused(sign(unsealed, "ssh-user-1-g1", spec(principals=["a,b"])), "principals")
    refused(sign(unsealed, "ssh-user-1-g1", spec(principals=["a", "a"])), "principals")


def test_a_host_certificate_has_no_options(unsealed, cas):
    refused(
        sign(unsealed, "ssh-host-1-g1", spec("host", extensions=["permit-pty"])),
        "ssh-options",
    )
    refused(
        sign(unsealed, "ssh-host-1-g1", spec("host", forceCommand="/bin/true")),
        "ssh-options",
    )


def test_subject_keys_openssh_takes(unsealed, cas):
    small = openssh(rsa.generate_private_key(65537, 2048).public_key())
    refused(sign(unsealed, "ssh-user-1-g1", spec(publicKey=small)), "subject-key")
    for key in (
        rsa.generate_private_key(65537, 3072).public_key(),
        ec.generate_private_key(ec.SECP384R1()).public_key(),
    ):
        ok(sign(unsealed, "ssh-user-1-g1", spec(publicKey=openssh(key))))


def test_never_an_issuers_key(unsealed, cas):
    issuer = ok(
        unsealed.post("/v1/keys", json={"purpose": "issuer", "algorithm": "Ed25519"})
    )
    key = load_pem_public_key(issuer["publicKey"].encode())
    refused(
        sign(unsealed, "ssh-user-1-g1", spec(publicKey=openssh(key))),
        "subject-key",
    )


def test_registering_needs_an_unshared_ed25519_issuer_key(unsealed, cas):
    p256 = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    subject = ok(
        unsealed.post("/v1/keys", json={"purpose": "subject", "algorithm": "Ed25519"})
    )
    used = ok(unsealed.get("/v1/ssh/cas/ssh-user-1-g1"), 200)["keyId"]
    for key_id in (p256["id"], subject["id"], used):
        refused(
            unsealed.post(
                "/v1/ssh/cas",
                json={
                    "id": "ssh-user-1-g2",
                    "keyId": key_id,
                    "kind": "user",
                    "maxValiditySeconds": DAY,
                },
            ),
            "issuer-key",
        )


def test_signing_needs_the_signer_unsealed(unsealed, cas):
    ok(unsealed.post("/v1/seal"), 204)
    assert sign(unsealed, "ssh-user-1-g1", spec()).status_code == 503


def test_a_key_that_is_not_openssh_is_a_bad_request(unsealed, cas):
    body = spec(publicKey="-----BEGIN PUBLIC KEY-----")
    assert sign(unsealed, "ssh-user-1-g1", body).status_code == 400
