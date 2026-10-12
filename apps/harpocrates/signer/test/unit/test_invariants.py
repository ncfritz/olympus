import ipaddress
from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from harpocrates_signer import invariants
from harpocrates_signer.errors import RefusedError

NOW = datetime.now(UTC)


def ca(
    *,
    permitted: list[x509.GeneralName] | None = None,
    excluded: list[x509.GeneralName] | None = None,
    usages: list[x509.ObjectIdentifier] | None = None,
    path_length: int | None = 0,
    days: int = 365,
) -> x509.Certificate:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Test CA")])
    builder = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(1)
        .not_valid_before(NOW - timedelta(days=1))
        .not_valid_after(NOW + timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=True, path_length=path_length), True)
    )
    if permitted or excluded:
        builder = builder.add_extension(
            x509.NameConstraints(permitted or None, excluded or None), True
        )
    if usages:
        builder = builder.add_extension(x509.ExtendedKeyUsage(usages), False)
    return builder.sign(key, hashes.SHA256())


def names(*dns: str, ip: tuple[str, ...] = (), email: tuple[str, ...] = ()):
    return invariants.Names(
        dns=dns,
        ip=tuple(ipaddress.ip_address(a) for a in ip),
        email=email,
    )


LOCALHOST = ca(
    permitted=[
        x509.DNSName("localhost"),
        x509.DNSName("internal.localhost"),
        x509.IPAddress(ipaddress.ip_network("127.0.0.0/8")),
    ],
    excluded=[x509.DNSName("secret.internal.localhost")],
)


@pytest.mark.parametrize(
    "name",
    [
        "localhost",
        "internal.localhost",
        "nas.internal.localhost",
        "A.Internal.Localhost",
    ],
)
def test_names_inside_the_constraints_pass(name):
    invariants.check_name_constraints(names(name, ip=("127.0.0.1",)), [LOCALHOST])


@pytest.mark.parametrize(
    "name",
    [
        "example.com",
        "evillocalhost",
        "localhost.example.com",
        "x.secret.internal.localhost",
    ],
)
def test_names_outside_the_constraints_are_refused(name):
    with pytest.raises(RefusedError) as refused:
        invariants.check_name_constraints(names(name), [LOCALHOST])
    assert refused.value.invariant == "name-constraints"


def test_an_address_outside_the_constraints_is_refused():
    with pytest.raises(RefusedError):
        invariants.check_name_constraints(names(ip=("10.0.0.1",)), [LOCALHOST])


def test_a_leading_dot_means_subdomains_only():
    constrained = ca(permitted=[x509.DNSName(".internal.localhost")])
    invariants.check_name_constraints(names("nas.internal.localhost"), [constrained])
    with pytest.raises(RefusedError):
        invariants.check_name_constraints(names("internal.localhost"), [constrained])


def test_email_constraints():
    constrained = ca(permitted=[x509.RFC822Name("ncfritz.net")])
    invariants.check_name_constraints(names(email=("neil@ncfritz.net",)), [constrained])
    with pytest.raises(RefusedError):
        invariants.check_name_constraints(
            names(email=("neil@example.com",)), [constrained]
        )


def test_every_ca_in_the_chain_constrains():
    open_ca = ca()
    with pytest.raises(RefusedError):
        invariants.check_name_constraints(names("example.com"), [open_ca, LOCALHOST])


def test_the_subject_cn_counts_when_it_is_a_hostname():
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "example.com")])
    with pytest.raises(RefusedError):
        invariants.check_name_constraints(invariants.names_of(subject, []), [LOCALHOST])
    service = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "olympus-api")])
    assert invariants.names_of(service, []).dns == ()


def test_validity_within_the_issuer_and_its_maximum():
    issuer = ca(days=365)
    invariants.check_validity(NOW, NOW + timedelta(days=90), issuer, 90)
    with pytest.raises(RefusedError):
        invariants.check_validity(NOW, NOW + timedelta(days=91), issuer, 90)
    with pytest.raises(RefusedError):
        invariants.check_validity(NOW, NOW + timedelta(days=400), issuer, 500)
    with pytest.raises(RefusedError):
        invariants.check_validity(NOW - timedelta(days=5), NOW, issuer, 90)
    with pytest.raises(RefusedError):
        invariants.check_validity(NOW, NOW, issuer, 90)


def test_extended_key_usages_are_the_registered_ones_and_within_the_chain():
    server = ExtendedKeyUsageOID.SERVER_AUTH
    client = ExtendedKeyUsageOID.CLIENT_AUTH
    tls = ca(usages=[server])
    invariants.check_extended_key_usages(
        [server], frozenset({server.dotted_string}), [tls]
    )
    with pytest.raises(RefusedError):
        invariants.check_extended_key_usages(
            [client], frozenset({server.dotted_string}), [tls]
        )
    with pytest.raises(RefusedError):
        invariants.check_extended_key_usages(
            [client], frozenset({server.dotted_string, client.dotted_string}), [tls]
        )


def test_an_online_issuer_never_signs_a_ca():
    invariants.check_not_a_ca(False)
    with pytest.raises(RefusedError) as refused:
        invariants.check_not_a_ca(True)
    assert refused.value.invariant == "ca"


def test_a_ca_signed_in_a_ceremony_sits_below_its_signer():
    intermediate = ca(path_length=1)
    invariants.check_path_length(intermediate, 0)
    for requested in (1, 2, None):
        with pytest.raises(RefusedError):
            invariants.check_path_length(intermediate, requested)


def test_serials_are_positive_and_at_most_159_bits():
    invariants.check_serial(1)
    invariants.check_serial(2**159 - 1)
    for bad in (0, -1, 2**159):
        with pytest.raises(RefusedError):
            invariants.check_serial(bad)


def _with_policies(*oids: str) -> x509.Certificate:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Policy CA")])
    return (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(1)
        .not_valid_before(NOW - timedelta(days=1))
        .not_valid_after(NOW + timedelta(days=30))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), True)
        .add_extension(
            x509.CertificatePolicies(
                [x509.PolicyInformation(x509.ObjectIdentifier(o), None) for o in oids]
            ),
            False,
        )
        .sign(key, hashes.SHA256())
    )


def test_policies_stay_within_the_cas_above():
    ev = x509.ObjectIdentifier("2.23.140.1.1")
    ov = x509.ObjectIdentifier("2.23.140.1.2.2")
    invariants.check_certificate_policies([ov], [LOCALHOST])
    invariants.check_certificate_policies([ov], [_with_policies("2.23.140.1.2.2")])
    invariants.check_certificate_policies([ev], [_with_policies("2.5.29.32.0")])
    with pytest.raises(RefusedError) as error:
        invariants.check_certificate_policies([ev], [_with_policies("2.23.140.1.2.2")])
    assert error.value.invariant == "certificate-policies"


def test_custom_extensions_are_unmanaged_single_and_well_formed():
    custom = x509.ObjectIdentifier("1.3.6.1.4.1.55555.1")
    invariants.check_custom_extensions([(custom, b"\x05\x00")])
    for extensions in (
        [(x509.ObjectIdentifier("2.5.29.17"), b"\x30\x00")],
        [(custom, b"\x05\x00"), (custom, b"\x05\x00")],
        [(custom, b"\x05")],
    ):
        with pytest.raises(RefusedError) as error:
            invariants.check_custom_extensions(extensions)
        assert error.value.invariant == "custom-extension"


# ---- OCSP (ADR 0036)


def test_an_ocsp_url_is_plain_http():
    invariants.check_ocsp_urls(["http://pki.internal.ncfritz.net/ocsp"])
    for url in ("https://pki/ocsp", "ldap://pki/ocsp", "http:///ocsp"):
        with pytest.raises(RefusedError, match="not an http") as refused:
            invariants.check_ocsp_urls([url])
        assert refused.value.invariant == "ocsp-url"


def test_must_staple_only_on_a_leaf_with_an_ocsp_url():
    invariants.check_tls_feature(False, [], ca=False)
    invariants.check_tls_feature(True, ["http://pki/ocsp"], ca=False)
    with pytest.raises(RefusedError, match="needs an OCSP URL"):
        invariants.check_tls_feature(True, [], ca=False)
    with pytest.raises(RefusedError, match="never must-staple"):
        invariants.check_tls_feature(True, ["http://pki/ocsp"], ca=True)


def test_a_responder_lives_inside_its_ca_and_its_maximum():
    issuer = ca(days=60)
    start = NOW
    invariants.check_responder_validity(start, start + timedelta(days=30), issuer, 35)
    for not_before, not_after, message in (
        (start, start + timedelta(days=36), "at most 35 days"),
        (start, start + timedelta(days=61), "past the CA"),
        (start - timedelta(days=2), start + timedelta(days=1), "before the CA"),
        (start, start, "after notBefore"),
    ):
        with pytest.raises(RefusedError, match=message) as refused:
            invariants.check_responder_validity(not_before, not_after, issuer, 35)
        assert refused.value.invariant == "ocsp-responder"


def test_a_response_is_current_short_and_inside_its_responder():
    responder = ca(days=10)
    invariants.check_ocsp_window(NOW, NOW + timedelta(days=4), responder, NOW)
    for this_update, next_update, now, message in (
        (NOW, NOW + timedelta(days=8), NOW, "at most a week"),
        (NOW, NOW + timedelta(days=11), NOW, "a week"),
        (
            NOW + timedelta(days=7),
            NOW + timedelta(days=11),
            NOW + timedelta(days=7),
            "past the responder",
        ),
        (NOW + timedelta(hours=1), NOW + timedelta(days=1), NOW, "in the future"),
        (NOW, NOW, NOW, "after thisUpdate"),
        (NOW, NOW + timedelta(days=1), NOW + timedelta(days=11), "not valid now"),
        (NOW - timedelta(days=2), NOW, NOW, "before the responder"),
    ):
        with pytest.raises(RefusedError, match=message) as refused:
            invariants.check_ocsp_window(this_update, next_update, responder, now)
        assert refused.value.invariant == "ocsp-window"
