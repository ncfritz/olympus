"""What the signer refuses, whatever the service asks (ADR 0020, The signer).

Each check raises RefusedError naming its invariant. They are pure functions
of the request and the issuer's certificates, so each has its own test.
"""

import ipaddress
import re
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from cryptography.x509.oid import CertificatePoliciesOID, ExtendedKeyUsageOID

from harpocrates_signer import der
from harpocrates_signer.errors import RefusedError

MAX_SERIAL = 2**159

type IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network
type IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address

HOSTNAME = re.compile(
    r"^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$"
)


@dataclass(frozen=True)
class Names:
    """Every name a certificate would carry, by type."""

    dns: tuple[str, ...] = ()
    ip: tuple[IPAddress, ...] = ()
    email: tuple[str, ...] = ()
    uri: tuple[str, ...] = ()


def names_of(subject: x509.Name, sans: Sequence[x509.GeneralName]) -> Names:
    """The names to check: the SANs, plus a subject CN that is a hostname
    and a subject email address, which some clients still read."""
    dns = [n.value for n in sans if isinstance(n, x509.DNSName)]
    ip = [n.value for n in sans if isinstance(n, x509.IPAddress)]
    email = [n.value for n in sans if isinstance(n, x509.RFC822Name)]
    uri = [n.value for n in sans if isinstance(n, x509.UniformResourceIdentifier)]
    for attribute in subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME):
        value = str(attribute.value).lower()
        if ("." in value or value == "localhost") and HOSTNAME.match(value):
            dns.append(value)
    for attribute in subject.get_attributes_for_oid(x509.NameOID.EMAIL_ADDRESS):
        email.append(str(attribute.value))
    return Names(
        dns=tuple(dns),
        ip=tuple(ip),  # type: ignore[arg-type]  # IPAddress SANs are addresses, not networks
        email=tuple(email),
        uri=tuple(uri),
    )


# ---- validity


def check_validity(
    not_before: datetime,
    not_after: datetime,
    issuer: x509.Certificate,
    max_validity_days: int,
) -> None:
    if not_after <= not_before:
        raise RefusedError("validity", "notAfter must be after notBefore")
    if not_before < issuer.not_valid_before_utc:
        raise RefusedError("validity", "notBefore is before the issuer's own")
    if not_after > issuer.not_valid_after_utc:
        raise RefusedError("validity", "notAfter is past the issuer's own expiry")
    if not_after - not_before > timedelta(days=max_validity_days):
        raise RefusedError(
            "validity", f"longer than the issuer's maximum of {max_validity_days} days"
        )


def check_serial(serial: int) -> None:
    if not 0 < serial < MAX_SERIAL:
        raise RefusedError("serial", "the serial must be positive and at most 159 bits")


# ---- basic constraints


def check_not_a_ca(ca: bool) -> None:
    """An online key never signs a CA: every online issuer has path length 0."""
    if ca:
        raise RefusedError("ca", "an online issuer cannot sign a CA certificate")


def check_path_length(signer: x509.Certificate, requested: int | None) -> None:
    """A CA signed in a ceremony sits below its signer: a path length
    strictly below the signer's, and never unbounded under a bounded one."""
    constraints = signer.extensions.get_extension_for_class(x509.BasicConstraints).value
    if not constraints.ca:
        raise RefusedError("ca", "the signing certificate is not a CA")
    if constraints.path_length is None:
        return
    if requested is None or requested >= constraints.path_length:
        raise RefusedError(
            "path-length",
            f"the path length must be below the signer's ({constraints.path_length})",
        )


# ---- extended key usage


def check_extended_key_usages(
    requested: Iterable[x509.ObjectIdentifier],
    allowed: frozenset[str],
    constraining: Sequence[x509.Certificate],
) -> None:
    """Requested usages must be ones the issuer is registered for, and
    within every EKU extension up the chain (a CA's EKU limits its leaves)."""
    wanted = {oid.dotted_string for oid in requested}
    outside = wanted - allowed
    if outside:
        raise RefusedError(
            "extended-key-usage",
            f"the issuer may not sign {', '.join(sorted(outside))}",
        )
    for certificate in constraining:
        try:
            usages = certificate.extensions.get_extension_for_class(
                x509.ExtendedKeyUsage
            ).value
        except x509.ExtensionNotFound:
            continue
        present = {oid.dotted_string for oid in usages}
        if ExtendedKeyUsageOID.ANY_EXTENDED_KEY_USAGE.dotted_string in present:
            continue
        if not wanted <= present:
            raise RefusedError(
                "extended-key-usage",
                "outside the extended key usages of "
                f"{certificate.subject.rfc4514_string()}",
            )


# ---- name constraints (RFC 5280, 4.2.1.10)


def check_name_constraints(
    names: Names, constraining: Sequence[x509.Certificate]
) -> None:
    for certificate in constraining:
        try:
            constraints = certificate.extensions.get_extension_for_class(
                x509.NameConstraints
            ).value
        except x509.ExtensionNotFound:
            continue
        where = certificate.subject.rfc4514_string()
        permitted = list(constraints.permitted_subtrees or [])
        excluded = list(constraints.excluded_subtrees or [])
        _check_kind(names.dns, x509.DNSName, permitted, excluded, _dns_matches, where)
        _check_kind(names.ip, x509.IPAddress, permitted, excluded, _ip_matches, where)
        _check_kind(
            names.email, x509.RFC822Name, permitted, excluded, _email_matches, where
        )
        _check_kind(
            names.uri,
            x509.UniformResourceIdentifier,
            permitted,
            excluded,
            _uri_matches,
            where,
        )


type Matcher[T] = Callable[[T, x509.GeneralName], bool]


def _check_kind[T](
    values: Sequence[T],
    kind: type[x509.GeneralName],
    permitted: Sequence[x509.GeneralName],
    excluded: Sequence[x509.GeneralName],
    matches: Matcher[T],
    where: str,
) -> None:
    allowed = [s for s in permitted if isinstance(s, kind)]
    denied = [s for s in excluded if isinstance(s, kind)]
    for value in values:
        if any(matches(value, s) for s in denied):
            raise RefusedError("name-constraints", f"{value} is excluded by {where}")
        if allowed and not any(matches(value, s) for s in allowed):
            raise RefusedError(
                "name-constraints", f"{value} is outside the names {where} permits"
            )


def _dns_in(name: str, base: str) -> bool:
    name = name.lower().rstrip(".")
    base = base.lower().rstrip(".")
    if base.startswith("."):
        return name.endswith(base)
    return name == base or name.endswith("." + base)


def _dns_matches(name: str, subtree: x509.GeneralName) -> bool:
    return _dns_in(name, str(subtree.value))


def _ip_matches(address: IPAddress, subtree: x509.GeneralName) -> bool:
    network: IPNetwork = subtree.value  # type: ignore[assignment]  # IPAddress subtrees are networks
    return address.version == network.version and address in network


def _email_matches(email: str, subtree: x509.GeneralName) -> bool:
    base = str(subtree.value).lower()
    email = email.lower()
    if "@" in base:
        return email == base
    host = email.rpartition("@")[2]
    if base.startswith("."):
        return host.endswith(base)
    return host == base


def _uri_matches(uri: str, subtree: x509.GeneralName) -> bool:
    host = (urlsplit(uri).hostname or "").lower()
    base = str(subtree.value).lower()
    if base.startswith("."):
        return host.endswith(base)
    return host == base


# ---- certificate policies


def check_certificate_policies(
    requested: Iterable[x509.ObjectIdentifier],
    constraining: Sequence[x509.Certificate],
) -> None:
    """A certificate's policies are within the policies of every CA above
    it that names its own, unless that CA asserts anyPolicy (RFC 5280,
    6.1: a policy outside them would not validate)."""
    wanted = {oid.dotted_string for oid in requested}
    if not wanted:
        return
    for certificate in constraining:
        try:
            policies = certificate.extensions.get_extension_for_class(
                x509.CertificatePolicies
            ).value
        except x509.ExtensionNotFound:
            continue
        present = {p.policy_identifier.dotted_string for p in policies}
        if CertificatePoliciesOID.ANY_POLICY.dotted_string in present:
            continue
        outside = wanted - present
        if outside:
            raise RefusedError(
                "certificate-policies",
                f"{', '.join(sorted(outside))} is outside the policies of "
                f"{certificate.subject.rfc4514_string()}",
            )


# ---- custom extensions

#: The extensions the signer builds itself, and the ones a leaf never
#: carries or Harpocrates does not yet offer (policy constraints and
#: mappings, inhibitAnyPolicy; the TLS feature, with OCSP; ADR 0034).
MANAGED_EXTENSIONS: dict[str, str] = {
    "2.5.29.14": "subject key identifier",
    "2.5.29.15": "key usage",
    "2.5.29.17": "subject alternative name",
    "2.5.29.18": "issuer alternative name",
    "2.5.29.19": "basic constraints",
    "2.5.29.30": "name constraints",
    "2.5.29.31": "CRL distribution points",
    "2.5.29.32": "certificate policies",
    "2.5.29.33": "policy mappings",
    "2.5.29.35": "authority key identifier",
    "2.5.29.36": "policy constraints",
    "2.5.29.37": "extended key usage",
    "2.5.29.54": "inhibit anyPolicy",
    "1.3.6.1.5.5.7.1.1": "authority information access",
    "1.3.6.1.5.5.7.1.24": "TLS feature",
    "1.3.6.1.5.5.7.48.1.5": "OCSP no check",
}


def check_custom_extensions(
    extensions: Sequence[tuple[x509.ObjectIdentifier, bytes]],
) -> None:
    """Custom extensions are none the signer manages, each once, each
    value one well-formed DER element."""
    seen: set[str] = set()
    for oid, value in extensions:
        dotted = oid.dotted_string
        if dotted in MANAGED_EXTENSIONS:
            raise RefusedError(
                "custom-extension",
                f"{dotted} ({MANAGED_EXTENSIONS[dotted]}) is not a custom extension",
            )
        if dotted in seen:
            raise RefusedError("custom-extension", f"{dotted} is given twice")
        seen.add(dotted)
        if not der.is_one_element(value):
            raise RefusedError(
                "custom-extension", f"{dotted}'s value is not one DER element"
            )


# ---- OCSP (ADR 0036)

#: The longest an OCSP response may be valid: its nextUpdate past its
#: thisUpdate. Responses are refreshed daily and valid four days.
MAX_OCSP_RESPONSE_VALIDITY = timedelta(days=7)

#: How far ahead of the signer's clock a response's thisUpdate may be.
OCSP_CLOCK_SKEW = timedelta(minutes=5)


def check_ocsp_urls(urls: Sequence[str]) -> None:
    """An OCSP URL is plain HTTP, as clients fetch it (RFC 6960, A.1)."""
    for url in urls:
        parts = urlsplit(url)
        if parts.scheme != "http" or not parts.hostname:
            raise RefusedError("ocsp-url", f"{url} is not an http:// URL")


def check_tls_feature(must_staple: bool, ocsp_urls: Sequence[str], ca: bool) -> None:
    """Must-staple (RFC 7633) only where a client can find the status it
    insists on: a leaf with an OCSP URL in its AIA."""
    if not must_staple:
        return
    if ca:
        raise RefusedError("tls-feature", "a CA's certificate is never must-staple")
    if not ocsp_urls:
        raise RefusedError(
            "tls-feature", "must-staple needs an OCSP URL in the certificate"
        )


def check_responder_validity(
    not_before: datetime,
    not_after: datetime,
    ca: x509.Certificate,
    max_days: int,
) -> None:
    """A responder lives inside its CA, no longer than it is allowed: it
    carries ocsp-nocheck, so its expiry is what limits it."""
    if not_after <= not_before:
        raise RefusedError("ocsp-responder", "notAfter must be after notBefore")
    if not_before < ca.not_valid_before_utc:
        raise RefusedError("ocsp-responder", "notBefore is before the CA's own")
    if not_after > ca.not_valid_after_utc:
        raise RefusedError("ocsp-responder", "notAfter is past the CA's own expiry")
    if not_after - not_before > timedelta(days=max_days):
        raise RefusedError(
            "ocsp-responder", f"a responder here is valid at most {max_days} days"
        )


def check_ocsp_window(
    this_update: datetime,
    next_update: datetime,
    responder: x509.Certificate,
    now: datetime,
) -> None:
    """A response is signed by a current responder, is not from the
    future, lasts no more than a week, and ends within its responder."""
    if not responder.not_valid_before_utc <= now < responder.not_valid_after_utc:
        raise RefusedError("ocsp-window", "the responder is not valid now")
    if this_update > now + OCSP_CLOCK_SKEW:
        raise RefusedError("ocsp-window", "thisUpdate is in the future")
    if this_update < responder.not_valid_before_utc:
        raise RefusedError("ocsp-window", "thisUpdate is before the responder's own")
    if next_update <= this_update:
        raise RefusedError("ocsp-window", "nextUpdate must be after thisUpdate")
    if next_update - this_update > MAX_OCSP_RESPONSE_VALIDITY:
        raise RefusedError("ocsp-window", "a response is valid at most a week")
    if next_update > responder.not_valid_after_utc:
        raise RefusedError("ocsp-window", "nextUpdate is past the responder's expiry")


# ---- SSH certificates (ADR 0035)

MAX_SSH_SERIAL = 2**64

#: The curves OpenSSH takes for ECDSA keys.
SSH_CURVES = ("secp256r1", "secp384r1", "secp521r1")

#: RSA below this is refused for SSH (OpenSSH's own floor is 1024; NIST's 2048
#: is past its use, and 3072 matches the X.509 profiles' RSA).
MIN_SSH_RSA_BITS = 3072


def check_ssh_kind(requested: str, ca_kind: str) -> None:
    """A user CA signs user certificates only, and a host CA host ones."""
    if requested != ca_kind:
        raise RefusedError(
            "ssh-kind", f"a {ca_kind} CA cannot sign a {requested} certificate"
        )


def check_ssh_validity(
    valid_after: datetime, valid_before: datetime, max_seconds: int
) -> None:
    if valid_before <= valid_after:
        raise RefusedError("validity", "validBefore must be after validAfter")
    if valid_before - valid_after > timedelta(seconds=max_seconds):
        raise RefusedError(
            "validity",
            f"longer than the CA's maximum of {max_seconds // 3600} hours",
        )


def check_ssh_principals(principals: Sequence[str]) -> None:
    """At least one principal: a certificate with none is valid for any
    user or host, which OpenSSH allows and Harpocrates does not."""
    if not principals:
        raise RefusedError("principals", "an SSH certificate names its principals")
    for principal in principals:
        if (
            not principal
            or principal != principal.strip()
            or any(c in principal for c in ",\n\r\t\0")
        ):
            raise RefusedError("principals", f"{principal!r} is not a principal")
    if len(set(principals)) != len(principals):
        raise RefusedError("principals", "a principal is named twice")


def check_ssh_options(kind: str, critical_options: bool, extensions: bool) -> None:
    """A host certificate carries no critical options or extensions: they
    restrict and permit what a user may do, not what a host is."""
    if kind == "host" and (critical_options or extensions):
        raise RefusedError(
            "ssh-options",
            "a host certificate has no critical options or extensions",
        )


def check_ssh_serial(serial: int) -> None:
    if not 0 < serial < MAX_SSH_SERIAL:
        raise RefusedError("serial", "an SSH serial is positive and at most 64 bits")


def check_ssh_subject_key(key: object) -> None:
    """A key OpenSSH certifies: Ed25519, ECDSA on its curves, RSA of 3072
    bits or more. DSA, which OpenSSH has dropped, is not."""
    if isinstance(key, ed25519.Ed25519PublicKey):
        return
    if isinstance(key, ec.EllipticCurvePublicKey) and key.curve.name in SSH_CURVES:
        return
    if isinstance(key, rsa.RSAPublicKey) and key.key_size >= MIN_SSH_RSA_BITS:
        return
    raise RefusedError(
        "subject-key",
        "an SSH key is Ed25519, ECDSA P-256/384/521, or RSA of 3072 bits or more",
    )
