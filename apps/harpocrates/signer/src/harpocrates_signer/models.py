"""The API's wire shapes (Pydantic), camelCase like the rest of Olympus,
and their conversion to the signer's own types."""

import ipaddress
from datetime import datetime
from enum import StrEnum

from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from harpocrates_signer.errors import BadRequestError, RefusedError
from harpocrates_signer.keys import KeyAlgorithm, KeyInfo, KeyPurpose, Keys, PublicKey
from harpocrates_signer.signing import (
    CertificateRequest,
    CrlRequest,
    IssuerInfo,
    NameConstraintsRequest,
    RevokedEntry,
)
from harpocrates_signer.vault import SealReason

SERIAL_PATTERN = r"^[0-9a-fA-F]{1,40}$"


class Wire(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
    )


class ErrorResponse(Wire):
    error: str = Field(description="A stable code: sealed, refused, not-found, ...")
    message: str
    invariant: str | None = Field(
        default=None, description="For `refused`: which invariant."
    )


# ---- seal


class CeremonyResponse(Wire):
    id: str
    subject: str
    opened_at: datetime
    expires_at: datetime


class StatusResponse(Wire):
    initialised: bool
    sealed: bool
    reason: SealReason | None = Field(description="Why it is sealed, if it is.")
    ceremony: CeremonyResponse | None = Field(description="The open ceremony.")
    keys: int = Field(description="Keys held, not counting destroyed ones.")


class PassphraseRequest(Wire):
    passphrase: str = Field(min_length=12)


class ChangePassphraseRequest(Wire):
    current: str
    new: str = Field(min_length=12)


class UnsealKeyResponse(Wire):
    unseal_key: str = Field(
        description="32 bytes, base64: the Compose secret. Shown once."
    )


# ---- keys


class GenerateKeyRequest(Wire):
    purpose: KeyPurpose
    algorithm: KeyAlgorithm = KeyAlgorithm.P256


class ImportKeyRequest(Wire):
    purpose: KeyPurpose
    private_key: str = Field(description="Encrypted PKCS#8, PEM.")
    passphrase: str


class KeyResponse(Wire):
    id: str
    purpose: KeyPurpose
    algorithm: str
    public_key: str = Field(description="SubjectPublicKeyInfo, PEM.")
    created_at: str
    destroyed: bool

    @staticmethod
    def of(info: KeyInfo) -> "KeyResponse":
        return KeyResponse(
            id=info.id,
            purpose=info.purpose,
            algorithm=info.algorithm,
            public_key=pem_public_key(info.public_key),
            created_at=info.created_at,
            destroyed=info.destroyed,
        )


class ExportFormatName(StrEnum):
    PEM = "pem"
    PKCS12 = "pkcs12"
    PKCS12_LEGACY = "pkcs12-legacy"


class ExportKeyRequest(Wire):
    format: ExportFormatName
    passphrase: str = Field(min_length=8)
    certificate: str | None = Field(
        default=None, description="PEM; required for PKCS#12."
    )
    chain: list[str] = Field(
        default_factory=list[str],
        description="PEM, issuer first; left out of legacy PKCS#12.",
    )


class ExportKeyResponse(Wire):
    format: ExportFormatName
    data: str = Field(description="The file, base64.")


# ---- issuers


class RegisterIssuerRequest(Wire):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{0,62}$", description="The CA's slug.")
    key_id: str
    certificate: str = Field(description="The issuer's certificate, PEM.")
    chain: list[str] = Field(
        default_factory=list[str],
        description="The CAs above it, PEM, nearest first; their name "
        "constraints and extended key usages bind what it signs.",
    )
    max_validity_days: int = Field(gt=0, le=3650)
    extended_key_usages: list[str] = Field(
        description="Dotted OIDs this issuer may put in a certificate."
    )


class IssuerResponse(Wire):
    id: str
    key_id: str
    certificate: str
    chain: list[str]
    max_validity_days: int
    extended_key_usages: list[str]

    @staticmethod
    def of(info: IssuerInfo) -> "IssuerResponse":
        return IssuerResponse(
            id=info.id,
            key_id=info.key_id,
            certificate=pem_certificate(info.certificate),
            chain=[pem_certificate(c) for c in info.chain],
            max_validity_days=info.max_validity_days,
            extended_key_usages=sorted(info.extended_key_usages),
        )


# ---- certificates


class KeyUsageName(StrEnum):
    DIGITAL_SIGNATURE = "digital_signature"
    CONTENT_COMMITMENT = "content_commitment"
    KEY_ENCIPHERMENT = "key_encipherment"
    DATA_ENCIPHERMENT = "data_encipherment"
    KEY_AGREEMENT = "key_agreement"
    KEY_CERT_SIGN = "key_cert_sign"
    CRL_SIGN = "crl_sign"


class Names(Wire):
    dns: list[str] = Field(default_factory=list[str])
    ip: list[str] = Field(default_factory=list[str])
    email: list[str] = Field(default_factory=list[str])
    uri: list[str] = Field(default_factory=list[str])


class NameConstraintsSpec(Wire):
    """For a CA: `ip` entries are networks (`10.0.0.0/8`)."""

    permitted: Names = Field(default_factory=Names)
    excluded: Names = Field(default_factory=Names)


class ExtensionSet(StrEnum):
    STANDARD = "standard"
    MINIMAL = "minimal"


class CertificateSpec(Wire):
    """Everything the certificate says. Exactly one of publicKey, csr and
    keyId gives the subject's key; a CSR's own subject and extensions are
    ignored, its signature is checked."""

    subject: str = Field(description="RFC 4514, e.g. CN=olympus-api,O=ncfritz.net")
    serial: str = Field(pattern=SERIAL_PATTERN, description="Hex, at most 159 bits.")
    not_before: AwareDatetime
    not_after: AwareDatetime
    key_usage: list[KeyUsageName]
    extended_key_usages: list[str] = Field(
        default_factory=list[str], description="Dotted OIDs."
    )
    sans: Names = Field(default_factory=Names)
    public_key: str | None = Field(default=None, description="PEM.")
    csr: str | None = Field(default=None, description="PEM.")
    key_id: str | None = None
    ca: bool = False
    path_length: int | None = Field(default=None, ge=0)
    name_constraints: NameConstraintsSpec | None = None
    crl_distribution_points: list[str] = Field(default_factory=list[str])
    issuer_urls: list[str] = Field(default_factory=list[str])
    extensions: ExtensionSet = Field(
        default=ExtensionSet.STANDARD,
        description="`minimal`: the key identifiers only, for a leaf whose "
        "consumer accepts nothing else; keyUsage and everything after it must "
        "then be empty.",
    )


class CertificateResponse(Wire):
    certificate: str = Field(description="PEM.")


class OfflineCaSpec(Wire):
    """A new offline CA: a root, or an intermediate signed in a ceremony."""

    certificate: CertificateSpec = Field(
        description="Its certificate; no key is given: it is generated."
    )
    algorithm: KeyAlgorithm = KeyAlgorithm.P256
    export_passphrase: str = Field(min_length=12)


class OfflineCaResponse(Wire):
    certificate: str = Field(description="PEM.")
    encrypted_key: str = Field(
        description="Encrypted PKCS#8, PEM: store it offline. Shown once."
    )


# ---- revocation lists


class RevocationReason(StrEnum):
    UNSPECIFIED = "unspecified"
    KEY_COMPROMISE = "keyCompromise"
    CA_COMPROMISE = "cACompromise"
    AFFILIATION_CHANGED = "affiliationChanged"
    SUPERSEDED = "superseded"
    CESSATION_OF_OPERATION = "cessationOfOperation"
    PRIVILEGE_WITHDRAWN = "privilegeWithdrawn"


class RevokedSpec(Wire):
    serial: str = Field(pattern=SERIAL_PATTERN)
    revoked_at: AwareDatetime
    reason: RevocationReason = RevocationReason.UNSPECIFIED


class CrlSpec(Wire):
    number: int = Field(gt=0, lt=2**53)
    this_update: AwareDatetime
    next_update: AwareDatetime
    revoked: list[RevokedSpec] = Field(default_factory=list[RevokedSpec])


class CrlResponse(Wire):
    crl: str = Field(description="PEM.")


# ---- ceremonies


class OpenCeremonyRequest(Wire):
    private_key: str = Field(description="The offline CA's encrypted PKCS#8, PEM.")
    passphrase: str
    certificate: str = Field(description="The offline CA's certificate, PEM.")


# ---- conversions


def pem_certificate(certificate: x509.Certificate) -> str:
    return certificate.public_bytes(serialization.Encoding.PEM).decode("ascii")


def pem_crl(crl: x509.CertificateRevocationList) -> str:
    return crl.public_bytes(serialization.Encoding.PEM).decode("ascii")


def pem_public_key(key: PublicKey) -> str:
    return key.public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("ascii")


def load_certificate(pem: str) -> x509.Certificate:
    try:
        return x509.load_pem_x509_certificate(pem.encode("ascii"))
    except ValueError as error:
        raise BadRequestError("a certificate is not PEM") from error


def _name(subject: str) -> x509.Name:
    try:
        return x509.Name.from_rfc4514_string(subject)
    except ValueError as error:
        raise BadRequestError("the subject is not an RFC 4514 name") from error


def _oid(dotted: str) -> x509.ObjectIdentifier:
    try:
        return x509.ObjectIdentifier(dotted)
    except ValueError as error:
        raise BadRequestError(f"{dotted} is not an OID") from error


def general_names(names: Names, networks: bool = False) -> tuple[x509.GeneralName, ...]:
    result: list[x509.GeneralName] = [x509.DNSName(n) for n in names.dns]
    try:
        for value in names.ip:
            address = (
                ipaddress.ip_network(value) if networks else ipaddress.ip_address(value)
            )
            result.append(x509.IPAddress(address))
    except ValueError as error:
        raise BadRequestError("an IP entry does not parse") from error
    result += [x509.RFC822Name(e) for e in names.email]
    result += [x509.UniformResourceIdentifier(u) for u in names.uri]
    return tuple(result)


def _public_key(spec: CertificateSpec, keys: Keys) -> PublicKey:
    given = [v for v in (spec.public_key, spec.csr, spec.key_id) if v is not None]
    if len(given) != 1:
        raise BadRequestError("give exactly one of publicKey, csr and keyId")
    if spec.key_id is not None:
        info = keys.info(spec.key_id)
        if info.destroyed:
            raise RefusedError("subject-key", "the key has been destroyed")
        return info.public_key
    if spec.csr is not None:
        try:
            csr = x509.load_pem_x509_csr(spec.csr.encode("ascii"))
        except ValueError as error:
            raise BadRequestError("the CSR is not PEM") from error
        if not csr.is_signature_valid:
            raise RefusedError(
                "proof-of-possession", "the CSR's signature does not verify"
            )
        key = csr.public_key()
    else:
        pem = spec.public_key or ""
        try:
            key = serialization.load_pem_public_key(pem.encode("ascii"))
        except ValueError as error:
            raise BadRequestError("the public key is not PEM") from error
    if not isinstance(
        key, ec.EllipticCurvePublicKey | rsa.RSAPublicKey | ed25519.Ed25519PublicKey
    ):
        raise BadRequestError("the key type is not supported")
    return key


def certificate_request(
    spec: CertificateSpec, keys: Keys, *, generated_key: bool = False
) -> CertificateRequest:
    """The signer's request. With `generated_key`, the key is made later
    (an offline CA) and a placeholder stands in until then."""
    if generated_key:
        subject_key: PublicKey = ec.generate_private_key(ec.SECP256R1()).public_key()
    else:
        subject_key = _public_key(spec, keys)
    constraints = None
    if spec.name_constraints is not None:
        constraints = NameConstraintsRequest(
            permitted=general_names(spec.name_constraints.permitted, networks=True),
            excluded=general_names(spec.name_constraints.excluded, networks=True),
        )
    return CertificateRequest(
        subject=_name(spec.subject),
        subject_key=subject_key,
        serial=int(spec.serial, 16),
        not_before=spec.not_before,
        not_after=spec.not_after,
        key_usage=frozenset(u.value for u in spec.key_usage),
        extended_key_usages=tuple(_oid(o) for o in spec.extended_key_usages),
        sans=general_names(spec.sans),
        ca=spec.ca,
        path_length=spec.path_length,
        name_constraints=constraints,
        crl_distribution_points=tuple(spec.crl_distribution_points),
        issuer_urls=tuple(spec.issuer_urls),
        minimal_extensions=spec.extensions is ExtensionSet.MINIMAL,
    )


def crl_request(spec: CrlSpec) -> CrlRequest:
    return CrlRequest(
        number=spec.number,
        this_update=spec.this_update,
        next_update=spec.next_update,
        revoked=tuple(
            RevokedEntry(
                serial=int(r.serial, 16),
                revoked_at=r.revoked_at,
                reason=x509.ReasonFlags(r.reason.value),
            )
            for r in spec.revoked
        ),
    )
