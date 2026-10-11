"""Certificates and revocation lists, from fully formed requests.

The service decides what a certificate says; the signer builds exactly
that, after its invariants, and adds only what follows from the issuer
(the key identifiers). It never decides whether a certificate should
exist (ADR 0020).
"""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ed25519, padding, rsa
from cryptography.hazmat.primitives.serialization import Encoding
from cryptography.x509.oid import AuthorityInformationAccessOID

from harpocrates_signer import der, invariants
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RefusedError,
)
from harpocrates_signer.keys import (
    KeyPurpose,
    Keys,
    PrivateKey,
    PublicKey,
    public_key_der,
)
from harpocrates_signer.store import IssuerRow, Store

_DER = Encoding.DER

ISSUER_ID = re.compile(r"^[a-z][a-z0-9-]{0,62}$")

KEY_USAGES = (
    "digital_signature",
    "content_commitment",
    "key_encipherment",
    "data_encipherment",
    "key_agreement",
    "key_cert_sign",
    "crl_sign",
)


class SignatureHash(StrEnum):
    SHA256 = "sha256"
    SHA384 = "sha384"
    SHA512 = "sha512"


class RsaPadding(StrEnum):
    PKCS1V15 = "pkcs1v15"
    PSS = "pss"


class KeyIdentifierMethod(StrEnum):
    """RFC 5280's SHA-1 of the key's bits, or RFC 7093's leftmost 160
    bits of their SHA-256; or no subject key identifier at all."""

    SHA1 = "sha1"
    SHA256 = "sha256"
    NONE = "none"


class AuthorityKeyIdentifierForm(StrEnum):
    KEY_ID = "key-id"
    KEY_ID_AND_ISSUER = "key-id-and-issuer"
    NONE = "none"


class BasicConstraintsForm(StrEnum):
    CRITICAL = "critical"
    NON_CRITICAL = "non-critical"
    OMITTED = "omitted"


_HASHES: dict[SignatureHash, type[hashes.SHA256 | hashes.SHA384 | hashes.SHA512]] = {
    SignatureHash.SHA256: hashes.SHA256,
    SignatureHash.SHA384: hashes.SHA384,
    SignatureHash.SHA512: hashes.SHA512,
}


@dataclass(frozen=True)
class PolicyRequest:
    oid: x509.ObjectIdentifier
    cps_uri: str | None = None
    user_notice: str | None = None


@dataclass(frozen=True)
class CustomExtension:
    oid: x509.ObjectIdentifier
    critical: bool
    value: bytes


@dataclass(frozen=True)
class NameConstraintsRequest:
    permitted: tuple[x509.GeneralName, ...] = ()
    excluded: tuple[x509.GeneralName, ...] = ()


@dataclass(frozen=True)
class CertificateRequest:
    """Everything a certificate says, decided by the service."""

    subject: x509.Name
    subject_key: PublicKey
    serial: int
    not_before: datetime
    not_after: datetime
    key_usage: frozenset[str]
    extended_key_usages: tuple[x509.ObjectIdentifier, ...] = ()
    sans: tuple[x509.GeneralName, ...] = ()
    ca: bool = False
    path_length: int | None = None
    name_constraints: NameConstraintsRequest | None = None
    crl_distribution_points: tuple[str, ...] = ()
    issuer_urls: tuple[str, ...] = ()
    # Only the key identifiers: for a consumer that accepts nothing else
    # (ADR 0032, the direct root's leaves). Never for a CA.
    minimal_extensions: bool = False
    # The profile version's choices (ADR 0034); the defaults are what the
    # signer always did.
    signature_hash: SignatureHash | None = None
    rsa_padding: RsaPadding = RsaPadding.PKCS1V15
    subject_key_identifier: KeyIdentifierMethod = KeyIdentifierMethod.SHA1
    authority_key_identifier: AuthorityKeyIdentifierForm = (
        AuthorityKeyIdentifierForm.KEY_ID
    )
    basic_constraints: BasicConstraintsForm = BasicConstraintsForm.CRITICAL
    issuer_alternative_names: tuple[x509.GeneralName, ...] = ()
    certificate_policies: tuple[PolicyRequest, ...] = ()
    custom_extensions: tuple[CustomExtension, ...] = ()


@dataclass(frozen=True)
class RevokedEntry:
    serial: int
    revoked_at: datetime
    reason: x509.ReasonFlags | None = None


@dataclass(frozen=True)
class CrlRequest:
    number: int
    this_update: datetime
    next_update: datetime
    revoked: tuple[RevokedEntry, ...] = field(default=())


@dataclass(frozen=True)
class IssuerInfo:
    id: str
    key_id: str
    certificate: x509.Certificate
    chain: tuple[x509.Certificate, ...]
    max_validity_days: int
    extended_key_usages: frozenset[str]


def signature_hash(key: PrivateKey) -> hashes.SHA256 | None:
    """A list's hash: SHA-256, or none for Ed25519."""
    return None if isinstance(key, ed25519.Ed25519PrivateKey) else hashes.SHA256()


def _sign(
    builder: x509.CertificateBuilder, key: PrivateKey, request: CertificateRequest
) -> x509.Certificate:
    """Signed with the request's hash and padding; the family is the
    issuer key's, and Ed25519 has no hash to choose."""
    if isinstance(key, ed25519.Ed25519PrivateKey):
        if request.signature_hash is not None:
            raise RefusedError(
                "signature", "an Ed25519 issuer signs with no separate hash"
            )
        if request.rsa_padding is not RsaPadding.PKCS1V15:
            raise RefusedError("signature", "PSS is for an RSA issuer")
        return builder.sign(key, None)
    algorithm = _HASHES[request.signature_hash or SignatureHash.SHA256]()
    if request.rsa_padding is RsaPadding.PSS:
        if not isinstance(key, rsa.RSAPrivateKey):
            raise RefusedError("signature", "PSS is for an RSA issuer")
        return builder.sign(
            key,
            algorithm,
            rsa_padding=padding.PSS(
                mgf=padding.MGF1(algorithm), salt_length=padding.PSS.DIGEST_LENGTH
            ),
        )
    return builder.sign(key, algorithm)


def key_identifier(key: PublicKey, method: KeyIdentifierMethod) -> bytes:
    """A key's identifier by RFC 5280's method (SHA-1) or RFC 7093's
    (SHA-256, its leftmost 160 bits), over the subjectPublicKey bits."""
    bits = der.subject_public_key_bits(public_key_der(key))
    if method is KeyIdentifierMethod.SHA256:
        return hashlib.sha256(bits).digest()[:20]
    return hashlib.sha1(bits, usedforsecurity=False).digest()


def _authority_key_identifier(
    request: CertificateRequest,
    issuer_public_key: PublicKey,
    issuer_certificate: x509.Certificate | None,
) -> x509.AuthorityKeyIdentifier | None:
    """The issuer's own subject key identifier where its certificate has
    one (RFC 5280 asks them to match), else its key's by SHA-1; with the
    issuer's issuer and serial when asked. A root is its own issuer."""
    form = request.authority_key_identifier
    if form is AuthorityKeyIdentifierForm.NONE:
        return None
    if issuer_certificate is None:
        method = request.subject_key_identifier
        identifier = key_identifier(
            issuer_public_key,
            KeyIdentifierMethod.SHA1 if method is KeyIdentifierMethod.NONE else method,
        )
        issuer_of_issuer, serial = request.subject, request.serial
    else:
        try:
            identifier = issuer_certificate.extensions.get_extension_for_class(
                x509.SubjectKeyIdentifier
            ).value.digest
        except x509.ExtensionNotFound:
            identifier = key_identifier(issuer_public_key, KeyIdentifierMethod.SHA1)
        issuer_of_issuer = issuer_certificate.issuer
        serial = issuer_certificate.serial_number
    if form is AuthorityKeyIdentifierForm.KEY_ID:
        return x509.AuthorityKeyIdentifier(identifier, None, None)
    return x509.AuthorityKeyIdentifier(
        identifier, [x509.DirectoryName(issuer_of_issuer)], serial
    )


def _with_key_identifiers(
    builder: x509.CertificateBuilder,
    request: CertificateRequest,
    issuer_public_key: PublicKey,
    issuer_certificate: x509.Certificate | None,
) -> x509.CertificateBuilder:
    if request.subject_key_identifier is not KeyIdentifierMethod.NONE:
        builder = builder.add_extension(
            x509.SubjectKeyIdentifier(
                key_identifier(request.subject_key, request.subject_key_identifier)
            ),
            critical=False,
        )
    authority = _authority_key_identifier(
        request, issuer_public_key, issuer_certificate
    )
    if authority is not None:
        builder = builder.add_extension(authority, critical=False)
    return builder


def _check_ca_form(request: CertificateRequest) -> None:
    """A CA's certificate carries critical basic constraints and a subject
    key identifier (RFC 5280, 4.2.1.9 and 4.2.1.2), whatever is asked."""
    if request.basic_constraints is not BasicConstraintsForm.CRITICAL:
        raise RefusedError(
            "basic-constraints", "a CA's basic constraints are present and critical"
        )
    if request.subject_key_identifier is KeyIdentifierMethod.NONE:
        raise RefusedError("key-identifier", "a CA has a subject key identifier")


def build_certificate(
    request: CertificateRequest,
    issuer_name: x509.Name,
    issuer_public_key: PublicKey,
    signing_key: PrivateKey,
    issuer_certificate: x509.Certificate | None = None,
) -> x509.Certificate:
    """`issuer_certificate` is None for a root, which signs itself."""
    unknown = request.key_usage - set(KEY_USAGES)
    if unknown:
        raise BadRequestError(f"unknown key usages: {', '.join(sorted(unknown))}")
    invariants.check_custom_extensions(
        [(e.oid, e.value) for e in request.custom_extensions]
    )
    if request.minimal_extensions:
        return _build_minimal(
            request, issuer_name, issuer_public_key, signing_key, issuer_certificate
        )
    if request.ca:
        _check_ca_form(request)
    usage = {name: name in request.key_usage for name in KEY_USAGES}
    builder = (
        x509.CertificateBuilder()
        .subject_name(request.subject)
        .issuer_name(issuer_name)
        .public_key(request.subject_key)
        .serial_number(request.serial)
        .not_valid_before(request.not_before)
        .not_valid_after(request.not_after)
    )
    if request.basic_constraints is not BasicConstraintsForm.OMITTED:
        builder = builder.add_extension(
            x509.BasicConstraints(
                ca=request.ca, path_length=request.path_length if request.ca else None
            ),
            critical=request.basic_constraints is BasicConstraintsForm.CRITICAL,
        )
    builder = builder.add_extension(
        x509.KeyUsage(encipher_only=False, decipher_only=False, **usage),
        critical=True,
    )
    builder = _with_key_identifiers(
        builder, request, issuer_public_key, issuer_certificate
    )
    if request.extended_key_usages:
        builder = builder.add_extension(
            x509.ExtendedKeyUsage(list(request.extended_key_usages)), critical=False
        )
    if request.sans:
        # Critical when the subject is empty (RFC 5280, 4.2.1.6).
        builder = builder.add_extension(
            x509.SubjectAlternativeName(list(request.sans)),
            critical=len(request.subject) == 0,
        )
    if request.issuer_alternative_names:
        builder = builder.add_extension(
            x509.IssuerAlternativeName(list(request.issuer_alternative_names)),
            critical=False,
        )
    if request.ca and request.name_constraints is not None:
        constraints = request.name_constraints
        builder = builder.add_extension(
            x509.NameConstraints(
                permitted_subtrees=list(constraints.permitted) or None,
                excluded_subtrees=list(constraints.excluded) or None,
            ),
            critical=True,
        )
    if request.crl_distribution_points:
        builder = builder.add_extension(
            x509.CRLDistributionPoints(
                [
                    x509.DistributionPoint(
                        full_name=[x509.UniformResourceIdentifier(url)],
                        relative_name=None,
                        reasons=None,
                        crl_issuer=None,
                    )
                    for url in request.crl_distribution_points
                ]
            ),
            critical=False,
        )
    if request.issuer_urls:
        builder = builder.add_extension(
            x509.AuthorityInformationAccess(
                [
                    x509.AccessDescription(
                        AuthorityInformationAccessOID.CA_ISSUERS,
                        x509.UniformResourceIdentifier(url),
                    )
                    for url in request.issuer_urls
                ]
            ),
            critical=False,
        )
    if request.certificate_policies:
        builder = builder.add_extension(
            x509.CertificatePolicies(
                [_policy(p) for p in request.certificate_policies]
            ),
            critical=False,
        )
    for extension in request.custom_extensions:
        builder = builder.add_extension(
            x509.UnrecognizedExtension(extension.oid, extension.value),
            critical=extension.critical,
        )
    return _sign(builder, signing_key, request)


def _policy(policy: PolicyRequest) -> x509.PolicyInformation:
    qualifiers: list[str | x509.UserNotice] = []
    if policy.cps_uri:
        qualifiers.append(policy.cps_uri)
    if policy.user_notice:
        qualifiers.append(x509.UserNotice(None, policy.user_notice))
    return x509.PolicyInformation(policy.oid, qualifiers or None)


def _build_minimal(
    request: CertificateRequest,
    issuer_name: x509.Name,
    issuer_public_key: PublicKey,
    signing_key: PrivateKey,
    issuer_certificate: x509.Certificate | None,
) -> x509.Certificate:
    """A leaf with the subject and authority key identifiers and nothing
    else: every other part of the request must be empty, so nothing asked
    for is silently dropped."""
    asked = [
        name
        for name, present in (
            ("ca", request.ca),
            ("keyUsage", bool(request.key_usage)),
            ("extendedKeyUsages", bool(request.extended_key_usages)),
            ("sans", bool(request.sans)),
            ("nameConstraints", request.name_constraints is not None),
            ("crlDistributionPoints", bool(request.crl_distribution_points)),
            ("issuerUrls", bool(request.issuer_urls)),
            ("issuerAlternativeNames", bool(request.issuer_alternative_names)),
            ("certificatePolicies", bool(request.certificate_policies)),
            ("customExtensions", bool(request.custom_extensions)),
        )
        if present
    ]
    if asked:
        raise BadRequestError(
            "minimal extensions carry only the key identifiers, not " + ", ".join(asked)
        )
    builder = (
        x509.CertificateBuilder()
        .subject_name(request.subject)
        .issuer_name(issuer_name)
        .public_key(request.subject_key)
        .serial_number(request.serial)
        .not_valid_before(request.not_before)
        .not_valid_after(request.not_after)
    )
    builder = _with_key_identifiers(
        builder, request, issuer_public_key, issuer_certificate
    )
    return _sign(builder, signing_key, request)


def build_crl(
    request: CrlRequest,
    issuer: x509.Certificate,
    signing_key: PrivateKey,
) -> x509.CertificateRevocationList:
    if request.next_update <= request.this_update:
        raise RefusedError("validity", "nextUpdate must be after thisUpdate")
    if request.next_update > issuer.not_valid_after_utc:
        raise RefusedError("validity", "nextUpdate is past the issuer's own expiry")
    if not 0 < request.number < invariants.MAX_SERIAL:
        raise RefusedError(
            "serial", "the list number must be positive and at most 159 bits"
        )
    builder = (
        x509.CertificateRevocationListBuilder()
        .issuer_name(issuer.subject)
        .last_update(request.this_update)
        .next_update(request.next_update)
        .add_extension(x509.CRLNumber(request.number), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(issuer.public_key()),  # type: ignore[arg-type]  # issuers hold the supported key types
            critical=False,
        )
    )
    for entry in request.revoked:
        revoked = (
            x509.RevokedCertificateBuilder()
            .serial_number(entry.serial)
            .revocation_date(entry.revoked_at)
        )
        if (
            entry.reason is not None
            and entry.reason is not x509.ReasonFlags.unspecified
        ):
            revoked = revoked.add_extension(
                x509.CRLReason(entry.reason), critical=False
            )
        builder = builder.add_revoked_certificate(revoked.build())
    return builder.sign(signing_key, signature_hash(signing_key))


def check_leaf(request: CertificateRequest, issuer: IssuerInfo, keys: Keys) -> None:
    """The invariants for an online issuer: everything but a CA."""
    constraining = (issuer.certificate, *issuer.chain)
    invariants.check_serial(request.serial)
    invariants.check_not_a_ca(request.ca)
    invariants.check_validity(
        request.not_before,
        request.not_after,
        issuer.certificate,
        issuer.max_validity_days,
    )
    invariants.check_extended_key_usages(
        request.extended_key_usages, issuer.extended_key_usages, constraining
    )
    invariants.check_name_constraints(
        invariants.names_of(request.subject, request.sans), constraining
    )
    invariants.check_certificate_policies(
        [p.oid for p in request.certificate_policies], constraining
    )
    check_subject_key(request.subject_key, keys)


def check_subject_key(subject_key: PublicKey, keys: Keys) -> None:
    """A CA's key is never a subject's (ADR 0020, Keys and enrollment)."""
    if keys.purpose_of_public_key(subject_key) is KeyPurpose.ISSUER:
        raise RefusedError("subject-key", "the subject key is an issuer's key")


def check_ca_key(ca_key: PublicKey, keys: Keys) -> None:
    """...and a subject's key is never a CA's."""
    if keys.purpose_of_public_key(ca_key) is KeyPurpose.SUBJECT:
        raise RefusedError("subject-key", "a CA's key cannot be a subject's key")


def _check_chain(
    certificate: x509.Certificate, chain: tuple[x509.Certificate, ...]
) -> None:
    """Each certificate is signed by the next: the chain whose constraints
    bind the issuer is its real one."""
    for child, parent in zip((certificate, *chain), chain, strict=False):
        try:
            child.verify_directly_issued_by(parent)
        except (ValueError, TypeError, InvalidSignature) as error:
            raise RefusedError(
                "chain",
                f"{child.subject.rfc4514_string()} is not signed by "
                f"{parent.subject.rfc4514_string()}",
            ) from error


class Issuers:
    """The online issuers: their certificates, and what each may sign."""

    def __init__(self, store: Store, keys: Keys) -> None:
        self._store = store
        self._keys = keys

    def register(
        self,
        issuer_id: str,
        key_id: str,
        certificate: x509.Certificate,
        chain: tuple[x509.Certificate, ...],
        max_validity_days: int,
        extended_key_usages: frozenset[str],
    ) -> IssuerInfo:
        if not ISSUER_ID.match(issuer_id):
            raise BadRequestError("an issuer id is a lower-case slug")
        key = self._keys.info(key_id)
        if key.purpose is not KeyPurpose.ISSUER:
            raise RefusedError("issuer-key", "the key is not an issuer's key")
        if public_key_der(key.public_key) != public_key_der(
            certificate.public_key()  # type: ignore[arg-type]  # checked by comparison
        ):
            raise RefusedError("issuer-key", "the certificate is not for this key")
        try:
            constraints = certificate.extensions.get_extension_for_class(
                x509.BasicConstraints
            ).value
        except x509.ExtensionNotFound as error:
            raise RefusedError("ca", "the certificate is not a CA") from error
        if not constraints.ca or constraints.path_length != 0:
            raise RefusedError(
                "path-length", "an online issuer is a CA with path length 0"
            )
        _check_chain(certificate, chain)
        if self._store.issuer(issuer_id) is not None:
            raise ConflictError(f"issuer {issuer_id} is already registered")
        self._store.insert_issuer(
            IssuerRow(
                id=issuer_id,
                key_id=key_id,
                certificate=certificate.public_bytes(_DER),
                max_validity_days=max_validity_days,
                chain=tuple(c.public_bytes(_DER) for c in chain),
                extended_key_usages=extended_key_usages,
            )
        )
        return self.get(issuer_id)

    def get(self, issuer_id: str) -> IssuerInfo:
        row = self._store.issuer(issuer_id)
        if row is None:
            raise NotFoundError(f"no issuer {issuer_id}")
        return IssuerInfo(
            id=row.id,
            key_id=row.key_id,
            certificate=x509.load_der_x509_certificate(row.certificate),
            chain=tuple(x509.load_der_x509_certificate(c) for c in row.chain),
            max_validity_days=row.max_validity_days,
            extended_key_usages=row.extended_key_usages,
        )

    def sign_certificate(
        self, issuer_id: str, request: CertificateRequest
    ) -> x509.Certificate:
        issuer = self.get(issuer_id)
        signing_key = self._keys.private_key(issuer.key_id)
        check_leaf(request, issuer, self._keys)
        return build_certificate(
            request,
            issuer.certificate.subject,
            signing_key.public_key(),
            signing_key,
            issuer.certificate,
        )

    def sign_crl(
        self, issuer_id: str, request: CrlRequest
    ) -> x509.CertificateRevocationList:
        issuer = self.get(issuer_id)
        signing_key = self._keys.private_key(issuer.key_id)
        return build_crl(request, issuer.certificate, signing_key)
