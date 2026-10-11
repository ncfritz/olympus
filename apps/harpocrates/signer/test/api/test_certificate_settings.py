"""The settings a profile version gives a certificate (ADR 0034): the
hash, the key identifier methods, basic constraints, issuer alternative
names, policies, custom extensions and the extra name types; each checked
by openssl where a relying party would check it."""

import base64
import hashlib

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.x509.oid import ExtensionOID, SignatureAlgorithmOID

from harpocrates_signer import der
from test.api.test_signing import refused, server_spec, sign, verify
from test.conftest import EXPORT_PASSPHRASE, ca_spec, load, ok

UPN = x509.ObjectIdentifier("1.3.6.1.4.1.311.20.2.3")
# A private-arc extension: a UTF8String "olympus".
CUSTOM_OID = "1.3.6.1.4.1.55555.1.1"
CUSTOM_VALUE = der.utf8_string("olympus")


def leaf_spec(**fields):
    """A server certificate for localhost, for a fresh public key."""
    key = ec.generate_private_key(ec.SECP256R1()).public_key()
    pem = key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo).decode()
    return server_spec(["localhost"], publicKey=pem, **fields)


def _bits(certificate: x509.Certificate) -> bytes:
    return der.subject_public_key_bits(
        certificate.public_key().public_bytes(
            Encoding.DER, PublicFormat.SubjectPublicKeyInfo
        )
    )


def test_the_defaults_are_what_it_always_signed(unsealed, hierarchy):
    pem = ok(sign(unsealed, hierarchy, leaf_spec()))["certificate"]
    leaf = load(pem)
    assert leaf.signature_algorithm_oid == SignatureAlgorithmOID.ECDSA_WITH_SHA256
    constraints = leaf.extensions.get_extension_for_class(x509.BasicConstraints)
    assert constraints.critical and not constraints.value.ca
    ski = leaf.extensions.get_extension_for_class(x509.SubjectKeyIdentifier).value
    assert ski == x509.SubjectKeyIdentifier.from_public_key(leaf.public_key())  # type: ignore[arg-type]
    aki = leaf.extensions.get_extension_for_class(x509.AuthorityKeyIdentifier).value
    issuing = load(hierarchy.issuing)
    assert (
        aki.key_identifier
        == issuing.extensions.get_extension_for_class(
            x509.SubjectKeyIdentifier
        ).value.digest
    )
    assert aki.authority_cert_issuer is None


def test_a_sha384_signature_verifies(tmp_path, unsealed, hierarchy):
    pem = ok(sign(unsealed, hierarchy, leaf_spec(signatureHash="sha384")))[
        "certificate"
    ]
    assert load(pem).signature_algorithm_oid == SignatureAlgorithmOID.ECDSA_WITH_SHA384
    result = verify(tmp_path, hierarchy, pem)
    assert result.returncode == 0, result.stderr


def test_pss_needs_an_rsa_issuer(unsealed, hierarchy):
    refused(
        sign(unsealed, hierarchy, leaf_spec(rsaPadding="pss")),
        "signature",
    )


def test_rfc_7093_key_identifier_and_the_issuers_name_and_serial(
    tmp_path, unsealed, hierarchy
):
    pem = ok(
        sign(
            unsealed,
            hierarchy,
            leaf_spec(
                subjectKeyIdentifier="sha256",
                authorityKeyIdentifier="key-id-and-issuer",
            ),
        )
    )["certificate"]
    leaf = load(pem)
    ski = leaf.extensions.get_extension_for_class(x509.SubjectKeyIdentifier).value
    assert ski.digest == hashlib.sha256(_bits(leaf)).digest()[:20]
    aki = leaf.extensions.get_extension_for_class(x509.AuthorityKeyIdentifier).value
    issuing = load(hierarchy.issuing)
    assert aki.authority_cert_issuer == [x509.DirectoryName(issuing.issuer)]
    assert aki.authority_cert_serial_number == issuing.serial_number
    result = verify(tmp_path, hierarchy, pem)
    assert result.returncode == 0, result.stderr


def test_without_key_identifiers_or_basic_constraints(unsealed, hierarchy):
    leaf = load(
        ok(
            sign(
                unsealed,
                hierarchy,
                leaf_spec(
                    subjectKeyIdentifier="none",
                    authorityKeyIdentifier="none",
                    basicConstraints="omitted",
                ),
            )
        )["certificate"]
    )
    present = {e.oid for e in leaf.extensions}
    assert ExtensionOID.SUBJECT_KEY_IDENTIFIER not in present
    assert ExtensionOID.AUTHORITY_KEY_IDENTIFIER not in present
    assert ExtensionOID.BASIC_CONSTRAINTS not in present


def test_non_critical_basic_constraints(unsealed, hierarchy):
    leaf = load(
        ok(
            sign(
                unsealed,
                hierarchy,
                leaf_spec(basicConstraints="non-critical"),
            )
        )["certificate"]
    )
    constraints = leaf.extensions.get_extension_for_class(x509.BasicConstraints)
    assert not constraints.critical and not constraints.value.ca


def test_names_policies_and_a_custom_extension(tmp_path, unsealed, hierarchy):
    body = leaf_spec(
        issuerAlternativeNames={
            "email": ["pki@internal.localhost"],
            "uri": ["https://pki.internal.localhost/"],
        },
        certificatePolicies=[
            {
                "oid": "1.3.6.1.4.1.55555.2.1",
                "cpsUri": "https://pki.internal.localhost/cps",
                "userNotice": "Internal use only",
            },
            {"oid": "2.23.140.1.2.1"},
        ],
        customExtensions=[
            {
                "oid": CUSTOM_OID,
                "value": base64.b64encode(CUSTOM_VALUE).decode(),
            }
        ],
    )
    body["sans"] = {
        "dns": ["localhost"],
        "upn": ["neil@internal.localhost"],
        "registeredId": ["1.3.6.1.4.1.55555.3"],
    }
    pem = ok(sign(unsealed, hierarchy, body))["certificate"]
    leaf = load(pem)
    ian = leaf.extensions.get_extension_for_class(x509.IssuerAlternativeName)
    assert not ian.critical
    assert ian.value.get_values_for_type(x509.RFC822Name) == ["pki@internal.localhost"]
    policies = leaf.extensions.get_extension_for_class(x509.CertificatePolicies).value
    assert [p.policy_identifier.dotted_string for p in policies] == [
        "1.3.6.1.4.1.55555.2.1",
        "2.23.140.1.2.1",
    ]
    qualifiers = policies[0].policy_qualifiers or []
    assert qualifiers[0] == "https://pki.internal.localhost/cps"
    assert isinstance(qualifiers[1], x509.UserNotice)
    assert qualifiers[1].explicit_text == "Internal use only"
    custom = leaf.extensions.get_extension_for_oid(x509.ObjectIdentifier(CUSTOM_OID))
    assert not custom.critical
    assert custom.value.value == CUSTOM_VALUE  # type: ignore[attr-defined]
    sans = leaf.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    (upn,) = sans.get_values_for_type(x509.OtherName)
    assert upn.type_id == UPN
    assert upn.value == der.utf8_string("neil@internal.localhost")
    assert sans.get_values_for_type(x509.RegisteredID) == [
        x509.ObjectIdentifier("1.3.6.1.4.1.55555.3")
    ]
    result = verify(tmp_path, hierarchy, pem)
    assert result.returncode == 0, result.stderr


def test_refuses_a_managed_extension_as_a_custom_one(unsealed, hierarchy):
    refused(
        sign(
            unsealed,
            hierarchy,
            leaf_spec(
                customExtensions=[
                    {
                        "oid": "2.5.29.19",
                        "value": base64.b64encode(b"\x30\x00").decode(),
                    }
                ],
            ),
        ),
        "custom-extension",
    )


def test_refuses_a_custom_value_that_is_not_one_der_element(unsealed, hierarchy):
    refused(
        sign(
            unsealed,
            hierarchy,
            leaf_spec(
                customExtensions=[
                    {
                        "oid": CUSTOM_OID,
                        "value": base64.b64encode(CUSTOM_VALUE + b"\x05\x00").decode(),
                    }
                ],
            ),
        ),
        "custom-extension",
    )


def test_refuses_a_bad_user_principal_name(unsealed, hierarchy):
    body = leaf_spec()
    body["sans"] = {"dns": ["localhost"], "upn": ["no-domain"]}
    response = sign(unsealed, hierarchy, body)
    assert response.status_code == 400, response.text


def test_minimal_extensions_refuse_policies(unsealed, hierarchy):
    body = leaf_spec(
        extensions="minimal",
        certificatePolicies=[{"oid": "2.23.140.1.2.1"}],
    )
    response = sign(unsealed, hierarchy, body)
    assert response.status_code == 400, response.text


def test_a_ca_keeps_critical_basic_constraints_and_its_key_identifier(unsealed):
    for fields, invariant in (
        ({"basicConstraints": "non-critical"}, "basic-constraints"),
        ({"subjectKeyIdentifier": "none"}, "key-identifier"),
    ):
        refused(
            unsealed.post(
                "/v1/roots",
                json={
                    "certificate": ca_spec(
                        "CN=Test Root CA 2,O=Olympus Test", 1, days=3650, **fields
                    ),
                    "exportPassphrase": EXPORT_PASSPHRASE,
                },
            ),
            invariant,
        )


def test_a_root_with_rfc_7093_identifiers_names_itself(unsealed):
    root = load(
        ok(
            unsealed.post(
                "/v1/roots",
                json={
                    "certificate": ca_spec(
                        "CN=Test Root CA 3,O=Olympus Test",
                        1,
                        days=3650,
                        subjectKeyIdentifier="sha256",
                        authorityKeyIdentifier="key-id-and-issuer",
                        signatureHash="sha512",
                    ),
                    "exportPassphrase": EXPORT_PASSPHRASE,
                },
            )
        )["certificate"]
    )
    ski = root.extensions.get_extension_for_class(x509.SubjectKeyIdentifier).value
    aki = root.extensions.get_extension_for_class(x509.AuthorityKeyIdentifier).value
    assert aki.key_identifier == ski.digest
    assert aki.authority_cert_issuer == [x509.DirectoryName(root.subject)]
    assert aki.authority_cert_serial_number == root.serial_number
    assert root.signature_algorithm_oid == SignatureAlgorithmOID.ECDSA_WITH_SHA512
    root.verify_directly_issued_by(root)
