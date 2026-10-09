"""Ceremonies: the only time an offline CA's key is in the signer (ADR 0020).

A root's or an intermediate's key is imported for one ceremony, signs
what the operator lists, and is forgotten when the ceremony closes, when
it times out, when the signer is sealed, or when the process ends. It is
never written to the store. Only in a ceremony may a certificate say
`CA:TRUE`.

What a ceremony signs follows from its CA's path length (ADR 0032,
shapes): a CA with path length 1 or more signs CAs below it, never a
leaf; a root with path length 0 (a root that signs directly) signs
leaves, never a CA.
"""

import logging
import threading
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization

from harpocrates_signer import invariants
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RefusedError,
)
from harpocrates_signer.keys import (
    KeyAlgorithm,
    Keys,
    PrivateKey,
    PublicKey,
    generate_private_key,
    load_encrypted_pkcs8,
    public_key_der,
)
from harpocrates_signer.signing import (
    CertificateRequest,
    CrlRequest,
    build_certificate,
    build_crl,
    check_ca_key,
    check_subject_key,
)
from harpocrates_signer.vault import Vault

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CeremonyInfo:
    id: str
    subject: str
    opened_at: datetime
    expires_at: datetime


@dataclass(frozen=True)
class OfflineCa:
    """A new offline CA: its certificate, and its key, encrypted, once."""

    certificate: x509.Certificate
    encrypted_key: bytes


@dataclass
class _Open:
    info: CeremonyInfo
    key: PrivateKey
    certificate: x509.Certificate
    timer: threading.Timer


def export_encrypted(key: PrivateKey, passphrase: str) -> bytes:
    """Encrypted PKCS#8 (PBES2), the form offline media and imports use."""
    if len(passphrase) < 12:
        raise BadRequestError("the export passphrase must be at least 12 characters")
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(passphrase.encode("utf-8")),
    )


def _check_ca_request(signer: x509.Certificate, request: CertificateRequest) -> None:
    if not request.ca:
        raise RefusedError(
            "ceremony",
            "this CA signs CAs; leaves come from issuing CAs, or from a root "
            "that signs directly",
        )
    invariants.check_serial(request.serial)
    invariants.check_path_length(signer, request.path_length)
    if request.not_before < signer.not_valid_before_utc:
        raise RefusedError("validity", "notBefore is before the signer's own")
    if request.not_after > signer.not_valid_after_utc:
        raise RefusedError("validity", "notAfter is past the signer's own expiry")
    if request.not_after <= request.not_before:
        raise RefusedError("validity", "notAfter must be after notBefore")
    invariants.check_extended_key_usages(
        request.extended_key_usages,
        frozenset(oid.dotted_string for oid in request.extended_key_usages),
        (signer,),
    )


def _check_leaf_request(signer: x509.Certificate, request: CertificateRequest) -> None:
    """What a root that signs directly may sign: leaves, inside its own
    validity, extended key usages and name constraints."""
    if request.ca:
        raise RefusedError(
            "ceremony", "a root with path length 0 signs leaves, never a CA"
        )
    invariants.check_serial(request.serial)
    if request.not_after <= request.not_before:
        raise RefusedError("validity", "notAfter must be after notBefore")
    if request.not_before < signer.not_valid_before_utc:
        raise RefusedError("validity", "notBefore is before the signer's own")
    if request.not_after > signer.not_valid_after_utc:
        raise RefusedError("validity", "notAfter is past the signer's own expiry")
    invariants.check_extended_key_usages(
        request.extended_key_usages,
        frozenset(oid.dotted_string for oid in request.extended_key_usages),
        (signer,),
    )
    invariants.check_name_constraints(
        invariants.names_of(request.subject, request.sans), (signer,)
    )


class Ceremonies:
    def __init__(self, vault: Vault, keys: Keys, timeout: timedelta) -> None:
        self._vault = vault
        self._keys = keys
        self._timeout = timeout
        self._lock = threading.RLock()
        self._open: _Open | None = None

    def current(self) -> CeremonyInfo | None:
        with self._lock:
            return None if self._open is None else self._open.info

    def open(self, key_pem: str, passphrase: str, certificate_pem: str) -> CeremonyInfo:
        self._vault.master_key()  # sealed means no ceremonies either
        key = load_encrypted_pkcs8(key_pem, passphrase)
        certificate = _load_certificate(certificate_pem)
        if public_key_der(key.public_key()) != public_key_der(
            certificate.public_key()  # type: ignore[arg-type]  # compared, not used
        ):
            raise RefusedError("ceremony", "the certificate is not for this key")
        if not (_signs_cas(certificate) or _signs_directly(certificate)):
            raise RefusedError(
                "ceremony",
                "a ceremony is for an offline CA: a CA with path length 1 or "
                "more, or a root that signs directly (path length 0)",
            )
        with self._lock:
            if self._open is not None:
                raise ConflictError("a ceremony is already open")
            opened = datetime.now(UTC)
            info = CeremonyInfo(
                id=str(uuid.uuid4()),
                subject=certificate.subject.rfc4514_string(),
                opened_at=opened,
                expires_at=opened + self._timeout,
            )
            timer = threading.Timer(
                self._timeout.total_seconds(), self._expire, args=(info.id,)
            )
            timer.daemon = True
            self._open = _Open(info, key, certificate, timer)
            timer.start()
        logger.info("Ceremony %s opened for %s", info.id, info.subject)
        return info

    def close(self, ceremony_id: str | None = None) -> None:
        """Forget the key. With no id, close whatever is open (sealing)."""
        with self._lock:
            if self._open is None:
                if ceremony_id is None:
                    return
                raise NotFoundError("no ceremony is open")
            if ceremony_id is not None and self._open.info.id != ceremony_id:
                raise NotFoundError(f"no ceremony {ceremony_id}")
            closing = self._open
            self._open = None
        closing.timer.cancel()
        logger.info("Ceremony %s closed", closing.info.id)

    def _expire(self, ceremony_id: str) -> None:
        with self._lock:
            if self._open is None or self._open.info.id != ceremony_id:
                return
            self._open = None
        logger.warning("Ceremony %s timed out; its key is gone", ceremony_id)

    def _held(self, ceremony_id: str) -> _Open:
        self._vault.master_key()
        with self._lock:
            if self._open is None or self._open.info.id != ceremony_id:
                raise NotFoundError(f"no ceremony {ceremony_id} is open")
            return self._open

    # ---- what a ceremony signs

    def sign_certificate(
        self, ceremony_id: str, request: CertificateRequest
    ) -> x509.Certificate:
        held = self._held(ceremony_id)
        if _signs_directly(held.certificate):
            _check_leaf_request(held.certificate, request)
            check_subject_key(request.subject_key, self._keys)
        else:
            _check_ca_request(held.certificate, request)
            check_ca_key(request.subject_key, self._keys)
        return build_certificate(
            request, held.certificate.subject, held.key.public_key(), held.key
        )

    def sign_crl(
        self, ceremony_id: str, request: CrlRequest
    ) -> x509.CertificateRevocationList:
        held = self._held(ceremony_id)
        return build_crl(request, held.certificate, held.key)

    def create_offline_ca(
        self,
        ceremony_id: str | None,
        request: CertificateRequest,
        algorithm: KeyAlgorithm,
        export_passphrase: str,
    ) -> OfflineCa:
        """A new root (no ceremony: it signs itself) or intermediate (signed
        in the ceremony), whose key leaves encrypted and is not kept.

        `request.subject_key` is ignored: the key is generated here.
        """
        key = generate_private_key(algorithm)
        subject_key: PublicKey = key.public_key()
        request = replace(request, subject_key=subject_key)
        if ceremony_id is None:
            self._vault.master_key()
            if not request.ca or request.path_length is None:
                raise RefusedError("path-length", "a root is a CA with a path length")
            invariants.check_serial(request.serial)
            if request.not_after <= request.not_before:
                raise RefusedError("validity", "notAfter must be after notBefore")
            certificate = build_certificate(request, request.subject, subject_key, key)
        else:
            certificate = self.sign_certificate(ceremony_id, request)
        encrypted = export_encrypted(key, export_passphrase)
        logger.info("Created offline CA %s", certificate.subject.rfc4514_string())
        return OfflineCa(certificate=certificate, encrypted_key=encrypted)


def _signs_cas(certificate: x509.Certificate) -> bool:
    try:
        constraints = certificate.extensions.get_extension_for_class(
            x509.BasicConstraints
        ).value
    except x509.ExtensionNotFound:
        return False
    return constraints.ca and (
        constraints.path_length is None or constraints.path_length >= 1
    )


def _signs_directly(certificate: x509.Certificate) -> bool:
    """A self-signed CA with path length 0: a root with nothing below it
    but the leaves it signs in its ceremonies."""
    try:
        constraints = certificate.extensions.get_extension_for_class(
            x509.BasicConstraints
        ).value
    except x509.ExtensionNotFound:
        return False
    if not constraints.ca or constraints.path_length != 0:
        return False
    if certificate.subject != certificate.issuer:
        return False
    try:
        certificate.verify_directly_issued_by(certificate)
    except (ValueError, TypeError, InvalidSignature):
        return False
    return True


def _load_certificate(pem: str) -> x509.Certificate:
    try:
        return x509.load_pem_x509_certificate(pem.encode("ascii"))
    except ValueError as error:
        raise BadRequestError("the certificate is not PEM") from error
