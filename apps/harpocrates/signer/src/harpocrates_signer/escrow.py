"""Escrow export: a generated subject key, handed to the operator again.

The service decides who may (pki-admin, a reason, a recent sign-in) and
records it; the signer only refuses what must never leave: an issuer's
key, or a key that does not belong to the certificate it is bundled with.
"""

from enum import StrEnum

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs12

from harpocrates_signer.errors import BadRequestError, RefusedError
from harpocrates_signer.keys import KeyPurpose, Keys, public_key_der

MIN_PASSPHRASE_LENGTH = 8
PBKDF2_ROUNDS = 600_000
LEGACY_ROUNDS = 2048


class ExportFormat(StrEnum):
    PEM = "pem"
    PKCS12 = "pkcs12"
    #: SHA-1 and 3DES, without the chain: devices that accept nothing newer
    #: (`legacy-device`, the printer).
    PKCS12_LEGACY = "pkcs12-legacy"


def export_key(
    keys: Keys,
    key_id: str,
    export_format: ExportFormat,
    passphrase: str,
    certificate: x509.Certificate | None,
    chain: tuple[x509.Certificate, ...],
) -> bytes:
    if len(passphrase) < MIN_PASSPHRASE_LENGTH:
        raise BadRequestError(
            f"the export passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters"
        )
    info = keys.info(key_id)
    if info.purpose is not KeyPurpose.SUBJECT:
        raise RefusedError("escrow", "an issuer's key is never exported")
    key = keys.private_key(key_id)
    secret = passphrase.encode("utf-8")

    if export_format is ExportFormat.PEM:
        return key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.BestAvailableEncryption(secret),
        )

    if certificate is None:
        raise BadRequestError("a PKCS#12 export needs the certificate")
    if public_key_der(certificate.public_key()) != public_key_der(  # type: ignore[arg-type]  # compared, not used
        info.public_key
    ):
        raise RefusedError("escrow", "the certificate is not for this key")

    if export_format is ExportFormat.PKCS12_LEGACY:
        encryption = (
            serialization.PrivateFormat.PKCS12.encryption_builder()
            .kdf_rounds(LEGACY_ROUNDS)
            .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
            .hmac_hash(hashes.SHA1())  # what the printer accepts
            .build(secret)
        )
        cas: list[x509.Certificate] | None = None
    else:
        encryption = (
            serialization.PrivateFormat.PKCS12.encryption_builder()
            .kdf_rounds(PBKDF2_ROUNDS)
            .key_cert_algorithm(pkcs12.PBES.PBESv2SHA256AndAES256CBC)
            .hmac_hash(hashes.SHA256())
            .build(secret)
        )
        cas = list(chain) or None
    name = certificate.subject.rfc4514_string().encode("utf-8")
    return pkcs12.serialize_key_and_certificates(
        name,
        key,  # type: ignore[arg-type]  # Ed25519 subject keys are SSH's, never escrowed
        certificate,
        cas,
        encryption,
    )
