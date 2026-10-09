"""The API client over real TLS, against a chain without Authority Key
Identifiers: what the home lab's server branch has today (api_ssl_context)."""

from __future__ import annotations

import datetime as dt
import socket
import ssl
import threading
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from minerva_mail_ml.config import ApiClient
from minerva_mail_ml.olympus_api import api_ssl_context


def _cert(subject, issuer, key, issuer_key, *, ca=False, eku=None, san=None):
    now = dt.datetime.now(dt.UTC)
    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, subject)]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, issuer)]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False
        )
    )
    # No AuthorityKeyIdentifier, anywhere: as XCA issued the server branch.
    if ca:
        builder = builder.add_extension(
            x509.KeyUsage(
                digital_signature=False,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
    if eku:
        builder = builder.add_extension(x509.ExtendedKeyUsage([eku]), critical=False)
    if san:
        builder = builder.add_extension(
            x509.SubjectAlternativeName([x509.DNSName(san)]), critical=False
        )
    return builder.sign(issuer_key, hashes.SHA256())


def _write(path: Path, *items) -> Path:
    out = b""
    for item in items:
        if isinstance(item, x509.Certificate):
            out += item.public_bytes(serialization.Encoding.PEM)
        else:
            out += item.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
    path.write_bytes(out)
    return path


@pytest.fixture
def pki(tmp_path: Path) -> dict[str, Path]:
    root_key, int_key, leaf_key, client_key = (
        ec.generate_private_key(ec.SECP256R1()) for _ in range(4)
    )
    root = _cert("Root", "Root", root_key, root_key, ca=True)
    issuing = _cert("Issuing CA 2", "Root", int_key, root_key, ca=True)
    server = _cert(
        "olympus-api",
        "Issuing CA 2",
        leaf_key,
        int_key,
        eku=ExtendedKeyUsageOID.SERVER_AUTH,
        san="olympus-api",
    )
    client = _cert(
        "minerva-mail-agent-ml",
        "Issuing CA 2",
        client_key,
        int_key,
        eku=ExtendedKeyUsageOID.CLIENT_AUTH,
    )
    return {
        "ca": _write(tmp_path / "services-ca.crt", root, issuing),
        "server": _write(tmp_path / "server.pem", server, leaf_key),
        "client.crt": _write(tmp_path / "client.crt", client),
        "client.key": _write(tmp_path / "client.key", client_key),
    }


def _handshake(context: ssl.SSLContext, pki: dict[str, Path]) -> None:
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(str(pki["server"]))
    listener = socket.create_server(("127.0.0.1", 0))
    port = listener.getsockname()[1]

    def serve() -> None:
        conn, _ = listener.accept()
        try:
            with server_context.wrap_socket(conn, server_side=True) as tls:
                tls.recv(1)
        except (ssl.SSLError, OSError):
            pass

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    try:
        with (
            socket.create_connection(("127.0.0.1", port), timeout=5) as raw,
            context.wrap_socket(raw, server_hostname="olympus-api"),
        ):
            pass
    finally:
        listener.close()
        thread.join(timeout=5)


def _config(pki: dict[str, Path]) -> ApiClient:
    return ApiClient(
        base_url="https://olympus-api:3443/v1",
        cert=pki["client.crt"],
        key=pki["client.key"],
        ca=pki["ca"],
    )


def test_python_default_refuses_a_chain_without_key_identifiers(pki) -> None:
    # Why api_ssl_context exists: the default context is strict.
    context = ssl.create_default_context(cafile=str(pki["ca"]))
    with pytest.raises(ssl.SSLCertVerificationError, match="Authority Key Identifier"):
        _handshake(context, pki)


def test_the_api_client_accepts_it_as_node_does(pki) -> None:
    _handshake(api_ssl_context(_config(pki)), pki)


def test_the_api_client_still_checks_the_name(pki) -> None:
    context = api_ssl_context(_config(pki))
    assert context.check_hostname is True
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert not context.verify_flags & ssl.VERIFY_X509_STRICT
