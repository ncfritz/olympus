"""The services listener over real TLS: only the mail agent gets in."""

from __future__ import annotations

import asyncio
import datetime as dt
import socket
import ssl
import threading
import time
from pathlib import Path

import httpx
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from minerva_mail_ml.__main__ import servers
from minerva_mail_ml.config import read_config
from minerva_mail_ml.tls import refusal

SERVICES_ISSUER = "Test Service Issuing CA"


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _cert(subject, issuer, key, issuer_key, *, ca=False, eku=None, san=None):
    now = dt.datetime.now(dt.UTC)
    builder = (
        x509.CertificateBuilder()
        .subject_name(_name(subject))
        .issuer_name(_name(issuer))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
        # Python 3.13 verifies strictly: key identifiers and usages, as the
        # dev CA's certificates have them.
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(issuer_key.public_key()),
            critical=False,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=not ca,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=ca,
                crl_sign=ca,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
    )
    if eku:
        builder = builder.add_extension(x509.ExtendedKeyUsage(eku), critical=False)
    if san:
        builder = builder.add_extension(
            x509.SubjectAlternativeName([x509.DNSName(san)]), critical=False
        )
    return builder.sign(issuer_key, hashes.SHA256())


def _write(path: Path, cert, key=None) -> None:
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    if key is not None:
        path.with_suffix(".key").write_bytes(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )


@pytest.fixture(scope="module")
def pki(tmp_path_factory) -> Path:
    d = tmp_path_factory.mktemp("pki")
    key = lambda: ec.generate_private_key(ec.SECP256R1())  # noqa: E731
    services_key, devices_key = key(), key()
    services = _cert(
        SERVICES_ISSUER, SERVICES_ISSUER, services_key, services_key, ca=True
    )
    devices = _cert(
        "Test Device Issuing CA",
        "Test Device Issuing CA",
        devices_key,
        devices_key,
        ca=True,
    )
    # Both issuers trusted, as a chain through a shared root would be: the
    # issuer check is what keeps a device certificate out.
    (d / "ca.pem").write_bytes(
        services.public_bytes(serialization.Encoding.PEM)
        + devices.public_bytes(serialization.Encoding.PEM)
    )
    server_key = key()
    _write(
        d / "server.pem",
        _cert(
            "minerva-mail-ml",
            SERVICES_ISSUER,
            server_key,
            services_key,
            eku=[ExtendedKeyUsageOID.SERVER_AUTH],
            san="localhost",
        ),
        server_key,
    )
    for name, cn, issuer, issuer_key in [
        ("agent", "minerva-mail-agent", SERVICES_ISSUER, services_key),
        ("api", "olympus-api", SERVICES_ISSUER, services_key),
        ("device", "minerva-mail-agent", "Test Device Issuing CA", devices_key),
    ]:
        k = key()
        _write(
            d / f"{name}.pem",
            _cert(cn, issuer, k, issuer_key, eku=[ExtendedKeyUsageOID.CLIENT_AUTH]),
            k,
        )
    return d


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def services_url(pki: Path, tmp_path_factory):
    from minerva_mail_ml.features.store import FeatureStore

    port, plain = _free_port(), _free_port()
    config = read_config(
        {
            "LISTEN_PORT": str(plain),
            "SERVICES_LISTEN_PORT": str(port),
            "TLS_CERT": str(pki / "server.pem"),
            "TLS_KEY": str(pki / "server.key"),
            "TLS_CA_SERVICES": str(pki / "ca.pem"),
            "SERVICES_ISSUER": SERVICES_ISSUER,
            "LOG_LEVEL": "error",
        }
    )
    store = FeatureStore(tmp_path_factory.mktemp("store") / "features.sqlite3")
    running = servers(config, store)
    loop = asyncio.new_event_loop()

    def run() -> None:
        asyncio.set_event_loop(loop)
        loop.run_until_complete(asyncio.gather(*(s.serve() for s in running)))

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not all(s.started for s in running) and time.time() < deadline:
        time.sleep(0.05)
    yield f"https://localhost:{port}"
    for s in running:
        s.should_exit = True
    thread.join(timeout=10)
    loop.close()
    store.close()


def _client(pki: Path, who: str | None) -> httpx.Client:
    context = ssl.create_default_context(cafile=str(pki / "ca.pem"))
    if who:
        context.load_cert_chain(str(pki / f"{who}.pem"), str(pki / f"{who}.key"))
    return httpx.Client(verify=context, timeout=5)


def test_the_mail_agent_gets_in(pki: Path, services_url: str) -> None:
    with _client(pki, "agent") as client:
        response = client.get(f"{services_url}/v1/features/versions")
    assert response.status_code == 200


@pytest.mark.parametrize("who", ["api", "device"])
def test_another_service_or_issuer_is_turned_away(
    pki: Path, services_url: str, who: str
) -> None:
    with _client(pki, who) as client, pytest.raises(httpx.TransportError):
        client.get(f"{services_url}/v1/features/versions")


def test_no_certificate_no_handshake(pki: Path, services_url: str) -> None:
    with _client(pki, None) as client, pytest.raises(httpx.TransportError):
        client.get(f"{services_url}/v1/features/versions")


def test_refusal_names_the_reason() -> None:
    from minerva_mail_ml.config import ServicesTls

    tls = ServicesTls(
        Path("c"),
        Path("k"),
        Path("a"),
        (),
        SERVICES_ISSUER,
        frozenset({"minerva-mail-agent"}),
    )
    cert = {
        "subject": ((("commonName", "minerva-mail-agent"),),),
        "issuer": ((("commonName", SERVICES_ISSUER),),),
    }
    assert refusal(cert, tls) is None
    assert "not allowed" in refusal(
        {**cert, "subject": ((("commonName", "olympus-api"),),)}, tls
    )
    assert "issuer" in refusal({**cert, "issuer": ((("commonName", "Other"),),)}, tls)
    assert refusal(None, tls) == "no client certificate"
