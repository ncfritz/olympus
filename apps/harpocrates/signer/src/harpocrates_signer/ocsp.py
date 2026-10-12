"""OCSP (ADR 0036): a delegated responder per CA, and its responses.

A responder is a certificate its CA issues for an `ocsp` key the signer
generated: `id-kp-OCSPSigning` only, `ocsp-nocheck`, nothing else. An
online CA issues its own; an offline CA's is issued in its ceremony. The
signer keeps the responder's certificate with its CA's, and from then on
signs responses with the responder's key for that CA's certificates
only: the CertID's issuer hashes are the signer's own, from the CA's
certificate, never the service's.
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding
from cryptography.x509 import ocsp
from cryptography.x509.oid import ExtendedKeyUsageOID

from harpocrates_signer import der, invariants
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RefusedError,
)
from harpocrates_signer.keys import (
    OCSP_KEY_ALGORITHM,
    KeyPurpose,
    Keys,
    PrivateKey,
    PublicKey,
    public_key_der,
)
from harpocrates_signer.signing import (
    KeyIdentifierMethod,
    key_identifier,
    signature_hash,
)
from harpocrates_signer.store import OcspResponderRow, Store

_DER = Encoding.DER

#: An online CA's responder: 30 days, renewed with 10 left (ADR 0036).
ONLINE_RESPONDER_MAX_DAYS = 35
#: An offline CA's, issued in its yearly ceremony: 13 months.
CEREMONY_RESPONDER_MAX_DAYS = 400

#: The most responses one request signs.
MAX_RESPONSES = 1000


class CertIdHash(StrEnum):
    """The hash a request's CertID uses: SHA-1, as RFC 5019 has clients
    send, or SHA-256."""

    SHA1 = "sha1"
    SHA256 = "sha256"


class OcspStatus(StrEnum):
    """What a response says. `unknown` is never signed ahead: a serial the
    CA never issued is answered `unauthorized`, unsigned."""

    GOOD = "good"
    REVOKED = "revoked"


_CERT_ID_HASHES: dict[CertIdHash, type[hashes.HashAlgorithm]] = {
    CertIdHash.SHA1: hashes.SHA1,
    CertIdHash.SHA256: hashes.SHA256,
}


@dataclass(frozen=True)
class ResponderRequest:
    """A responder certificate, as the service asks for it."""

    subject: x509.Name
    key_id: str
    serial: int
    not_before: datetime
    not_after: datetime


@dataclass(frozen=True)
class ResponderInfo:
    key_id: str
    certificate: x509.Certificate
    ca_certificate: x509.Certificate


@dataclass(frozen=True)
class OcspEntry:
    serial: int
    hash: CertIdHash
    status: OcspStatus
    revoked_at: datetime | None = None
    reason: x509.ReasonFlags | None = None


def _is_ca(certificate: x509.Certificate) -> bool:
    try:
        return certificate.extensions.get_extension_for_class(
            x509.BasicConstraints
        ).value.ca
    except x509.ExtensionNotFound:
        return False


def build_responder_certificate(
    request: ResponderRequest,
    subject_key: PublicKey,
    ca: x509.Certificate,
    ca_key: PrivateKey,
) -> x509.Certificate:
    """The responder's certificate: a leaf for OCSP signing alone, with no
    revocation pointers of its own (RFC 6960, 4.2.2.2)."""
    ca_public_key: PublicKey = ca.public_key()  # type: ignore[assignment]  # a CA holds a supported key
    try:
        authority = ca.extensions.get_extension_for_class(
            x509.SubjectKeyIdentifier
        ).value.digest
    except x509.ExtensionNotFound:
        authority = key_identifier(ca_public_key, KeyIdentifierMethod.SHA1)
    builder = (
        x509.CertificateBuilder()
        .subject_name(request.subject)
        .issuer_name(ca.subject)
        .public_key(subject_key)
        .serial_number(request.serial)
        .not_valid_before(request.not_before)
        .not_valid_after(request.not_after)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.OCSP_SIGNING]), critical=False
        )
        .add_extension(x509.OCSPNoCheck(), critical=False)
        .add_extension(
            x509.SubjectKeyIdentifier(
                key_identifier(subject_key, KeyIdentifierMethod.SHA1)
            ),
            critical=False,
        )
        .add_extension(
            x509.AuthorityKeyIdentifier(authority, None, None), critical=False
        )
    )
    return builder.sign(ca_key, signature_hash(ca_key))


def issuer_hashes(ca: x509.Certificate, algorithm: CertIdHash) -> tuple[bytes, bytes]:
    """A CertID's issuerNameHash and issuerKeyHash for this CA: over its
    subject's DER, and over its subjectPublicKey's bits."""
    name = ca.subject.public_bytes()
    key_bits = der.subject_public_key_bits(
        public_key_der(ca.public_key())  # type: ignore[arg-type]  # a CA holds a supported key
    )
    return (
        hashlib.new(algorithm.value, name, usedforsecurity=False).digest(),
        hashlib.new(algorithm.value, key_bits, usedforsecurity=False).digest(),
    )


class Responders:
    """The responders: each CA's certificate for its OCSP key, and the
    responses that key signs."""

    def __init__(self, store: Store, keys: Keys) -> None:
        self._store = store
        self._keys = keys

    def issue(
        self,
        request: ResponderRequest,
        ca: x509.Certificate,
        ca_key: PrivateKey,
        max_days: int,
    ) -> ResponderInfo:
        """Issue and keep a responder for `ca`, signed by `ca_key`: an
        online CA's own key, or an offline CA's in its ceremony."""
        if not _is_ca(ca):
            raise RefusedError("ocsp-responder", "only a CA has a responder")
        key = self._keys.info(request.key_id)
        if key.purpose is not KeyPurpose.OCSP or key.destroyed:
            raise RefusedError("ocsp-key", "the key is not an OCSP responder's key")
        if key.algorithm != OCSP_KEY_ALGORITHM:
            raise RefusedError("ocsp-key", "an OCSP responder's key is P-256")
        if self._store.ocsp_responder(request.key_id) is not None:
            raise ConflictError("this key already has a responder certificate")
        invariants.check_serial(request.serial)
        invariants.check_responder_validity(
            request.not_before, request.not_after, ca, max_days
        )
        certificate = build_responder_certificate(request, key.public_key, ca, ca_key)
        self._store.insert_ocsp_responder(
            OcspResponderRow(
                key_id=request.key_id,
                ca_certificate=ca.public_bytes(_DER),
                certificate=certificate.public_bytes(_DER),
            )
        )
        return self.get(request.key_id)

    def get(self, key_id: str) -> ResponderInfo:
        row = self._store.ocsp_responder(key_id)
        if row is None:
            raise NotFoundError(f"no OCSP responder for key {key_id}")
        return ResponderInfo(
            key_id=row.key_id,
            certificate=x509.load_der_x509_certificate(row.certificate),
            ca_certificate=x509.load_der_x509_certificate(row.ca_certificate),
        )

    def sign(
        self,
        key_id: str,
        this_update: datetime,
        next_update: datetime,
        entries: tuple[OcspEntry, ...],
        now: datetime | None = None,
    ) -> list[bytes]:
        """One signed response per entry, DER, in order: each for a serial
        of this responder's CA, good or revoked."""
        responder = self.get(key_id)
        if not 0 < len(entries) <= MAX_RESPONSES:
            raise BadRequestError(f"between 1 and {MAX_RESPONSES} responses at once")
        invariants.check_ocsp_window(
            this_update, next_update, responder.certificate, now or datetime.now(UTC)
        )
        for entry in entries:
            invariants.check_serial(entry.serial)
            if entry.status is OcspStatus.REVOKED:
                if entry.revoked_at is None:
                    raise BadRequestError("a revoked status needs its time")
                if entry.revoked_at > this_update:
                    raise RefusedError(
                        "ocsp-window", "a revocation is after the response's thisUpdate"
                    )
            elif entry.revoked_at is not None or entry.reason is not None:
                raise BadRequestError("a good status has no revocation")
        key = self._keys.private_key(key_id)
        if not isinstance(key, ec.EllipticCurvePrivateKey):
            raise TypeError("an OCSP responder's key is P-256")
        return [
            self._response(responder, key, this_update, next_update, entry)
            for entry in entries
        ]

    @staticmethod
    def _response(
        responder: ResponderInfo,
        key: ec.EllipticCurvePrivateKey,
        this_update: datetime,
        next_update: datetime,
        entry: OcspEntry,
    ) -> bytes:
        name_hash, key_hash = issuer_hashes(responder.ca_certificate, entry.hash)
        revoked = entry.status is OcspStatus.REVOKED
        response = (
            ocsp.OCSPResponseBuilder()
            .add_response_by_hash(
                issuer_name_hash=name_hash,
                issuer_key_hash=key_hash,
                serial_number=entry.serial,
                algorithm=_CERT_ID_HASHES[entry.hash](),
                cert_status=ocsp.OCSPCertStatus.REVOKED
                if revoked
                else ocsp.OCSPCertStatus.GOOD,
                this_update=this_update,
                next_update=next_update,
                revocation_time=entry.revoked_at if revoked else None,
                revocation_reason=entry.reason if revoked else None,
            )
            .responder_id(ocsp.OCSPResponderEncoding.HASH, responder.certificate)
            .certificates([responder.certificate])
            .sign(key, hashes.SHA256())
        )
        return response.public_bytes(_DER)
