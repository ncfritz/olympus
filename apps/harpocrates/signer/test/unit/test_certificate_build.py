"""Building a certificate with a version's signature settings, directly:
PSS under an RSA issuer, and Ed25519's lack of a hash."""

from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, padding, rsa
from cryptography.x509.oid import NameOID, SignatureAlgorithmOID

from harpocrates_signer import der
from harpocrates_signer.errors import RefusedError
from harpocrates_signer.signing import (
    CertificateRequest,
    KeyIdentifierMethod,
    RsaPadding,
    SignatureHash,
    build_certificate,
    key_identifier,
)

NOW = datetime.now(UTC)
NAME = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Test")])


def request(**fields) -> CertificateRequest:
    return CertificateRequest(
        **{
            "subject": NAME,
            "subject_key": ec.generate_private_key(ec.SECP256R1()).public_key(),
            "serial": 1,
            "not_before": NOW,
            "not_after": NOW + timedelta(days=1),
            "key_usage": frozenset({"digital_signature"}),
            **fields,
        }
    )


def test_pss_with_sha384_under_an_rsa_issuer():
    issuer = rsa.generate_private_key(65537, 2048)
    certificate = build_certificate(
        request(rsa_padding=RsaPadding.PSS, signature_hash=SignatureHash.SHA384),
        NAME,
        issuer.public_key(),
        issuer,
    )
    assert certificate.signature_algorithm_oid == SignatureAlgorithmOID.RSASSA_PSS
    assert isinstance(certificate.signature_algorithm_parameters, padding.PSS)
    issuer.public_key().verify(
        certificate.signature,
        certificate.tbs_certificate_bytes,
        certificate.signature_algorithm_parameters,
        certificate.signature_hash_algorithm,  # type: ignore[arg-type]
    )


def test_an_ed25519_issuer_takes_no_hash():
    issuer = ed25519.Ed25519PrivateKey.generate()
    build_certificate(request(), NAME, issuer.public_key(), issuer)
    with pytest.raises(RefusedError) as error:
        build_certificate(
            request(signature_hash=SignatureHash.SHA256),
            NAME,
            issuer.public_key(),
            issuer,
        )
    assert error.value.invariant == "signature"


def test_the_sha1_method_is_cryptographys():
    key = ec.generate_private_key(ec.SECP384R1()).public_key()
    assert (
        key_identifier(key, KeyIdentifierMethod.SHA1)
        == x509.SubjectKeyIdentifier.from_public_key(key).digest
    )


def test_der_elements():
    assert der.is_one_element(b"\x05\x00")
    assert der.is_one_element(der.utf8_string("x" * 300))
    assert not der.is_one_element(b"\x05\x00\x05\x00")
    assert not der.is_one_element(b"\x04\x05abc")
    assert not der.is_one_element(b"\x04\x81\x05abcde")  # not minimal
    assert not der.is_one_element(b"")
