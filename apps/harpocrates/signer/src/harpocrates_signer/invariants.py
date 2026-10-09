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
from cryptography.x509.oid import ExtendedKeyUsageOID

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
