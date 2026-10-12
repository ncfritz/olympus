# 0034. Harpocrates: profiles as versioned, editable presets

- **Status:** Accepted; amended by [ADR 0035](0035-harpocrates-ssh-certificates.md) (2026-10-11): a profile has a kind, `x509` or `ssh`, and an SSH version holds SSH settings
- **Date:** 2026-10-11; accepted 2026-10-11 (Neil)
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md) (Profiles),
  [ADR 0033](0033-harpocrates-key-types-and-imported-keys.md) (key types)

## Context

ADR 0020's profiles are seed data: a fixed set, one row each, of which
the API changes only the pinned issuer. What a profile decides is a
handful of columns (key type, usages, SAN types, validity, enrollment
modes, escrow), and the certificate built from it is otherwise the
signer's fixed shape: SHA-256, the standard extensions, the subject as
the request gives it.

Administrators want to make and change profiles themselves, as
opinionated presets over a system that can otherwise produce whatever a
certificate needs. A change to a profile must not change what a
certificate already issued under it was, nor break its renewal.

## Decision

### Profiles and versions

- A **profile** is a stable slug (`internal-tls`), a description and
  whether it is **active**. Deactivating is the delete: nothing new may
  choose an inactive profile, but what was issued under it renews as
  before. It can be reactivated.
- A profile has **versions**, v1, v2, …: every setting below, frozen.
  Editing a profile makes its next version; no version changes once
  made. Each records who made it and when.
- A new certificate takes the **latest version** of an active profile.
  An enrollment and each certificate record the version they were
  issued under.
- **A renewal keeps its version.** An admin may move chosen enrollments
  to a newer version of the same profile; their next renewal uses it.
- **Copying** makes a new profile whose v1 is any version of any
  profile.
- The seeded profiles become v1 of themselves, unchanged. `ACME_PROFILE`
  names a profile and gets its latest version.
- Making, versioning, copying, deactivating and reactivating a profile,
  and moving enrollments, are a pki-admin's, after a recent sign-in, and
  audited.
- Profiles are for **leaf certificates** (and, by ADR 0035, SSH
  certificates, as profiles of the `ssh` kind). A CA's settings stay with its
  ceremony (ADR 0032); more flexibility there is later work.

### What a version holds

Every setting carries help in the console.

- **General**: the issuing CA purpose and default issuer; validity,
  renewal due, maximum key age; enrollment modes (CSR, generated,
  imported); escrow and whether a request may override it; the export
  format.
- **Key types** (amending ADR 0033): the types a request may choose,
  and the default. An empty list means any type the signer generates.
- **Signature**: the certificate's hash (SHA-256, SHA-384, SHA-512) and,
  under an RSA issuer, PKCS#1 v1.5 or PSS; the family is the issuer's
  key's, and Ed25519 has no hash to choose. And the signature hashes a
  CSR may be signed with, so SHA-1 CSRs can be refused.
- **Subject DN**: per attribute, _required_, _optional_ or _excluded_,
  with an optional default value, whether that value is locked, a
  pattern the value must match, and how many values it may take. The
  standard set is C, ST, L, O, OU, CN and emailAddress; the free-form
  set, as XCA offers it, is serialNumber, title, givenName, surname,
  initials, pseudonym, generationQualifier, dnQualifier, description,
  businessCategory, postalCode, street, UID, DC and the EV jurisdiction
  attributes; any other attribute by its OID.
- **Subject alternative names**: per type (DNS, IP, email, URI,
  otherName UPN, registeredID), _allowed_, _required_ or _excluded_,
  and how many names at least.
- **Name policy**: per SAN type, permitted and excluded subtrees, which
  a request's names must satisfy. RFC 5280 allows the nameConstraints
  extension in CA certificates only; this is its leaf counterpart,
  enforced at issuance, as ACME credentials' name policies are. A CA's
  own constraints still apply on top.
- **Key usage and extended key usage**: each usage _forced_ (always),
  _default_ (on unless removed), _optional_ (off unless added) or
  _excluded_ (never). A request may add or remove only the default and
  optional ones; a CSR's requested extensions are honoured within the
  same rules.
- **Basic constraints**: present or not, critical or not; always
  `CA:FALSE`.
- **Key identifiers**: the subject key identifier, on or off, by
  RFC 5280's SHA-1 method or RFC 7093's truncated SHA-256; the authority
  key identifier, on or off, its key identifier alone or with the
  issuer's name and serial.
- **Distribution**: the CRL distribution point and the AIA caIssuers
  URL come from the issuer at signing; the profile includes or omits
  each.
- **Issuer alternative name** describes the CA, so it is the CA's: an
  optional setting on each CA (an email or URI for whoever runs it),
  which the profile includes or omits, off by default. A request never
  sets it: that would let a subscriber say who issued its certificate.
- **Certificate policies**: policy OIDs, each with an optional CPS URI
  and user notice.
- **Custom extensions**: by OID, critical or not, the value as DER. Not
  for an extension Harpocrates manages itself (basic constraints, key
  usage, EKU, SAN, IAN, name constraints, the key identifiers, CRL
  distribution points, AIA, certificate policies).

A version is checked when it is made (a usage both forced and excluded,
keyEncipherment forced with only EC key types, a default value that
fails its own pattern), and the console previews the certificate a
version would produce before it is saved.

### The signer stays the last word

The service applies a version's rules; the signer applies its
invariants (ADR 0020) to whatever it is asked to sign, and is extended
to take the new settings (hash and padding, key identifier methods,
basic constraints, IAN, policies, custom extensions). A profile cannot
produce what the invariants forbid.

### OCSP, planned

ADR 0020 provides no OCSP. A later phase adds a responder, the AIA OCSP
URL and an OCSP must-staple (TLS feature) setting in profiles, under an
ADR of its own; until then neither is offered.

## Consequences

- Profiles move from seed data to administered data with history; the
  console gains a profile list, version history with a diff, and an
  editor, and the issuance form follows the chosen version's rules.
- The issuance path checks more, and the signer's certificate spec
  grows; its document, client and tests with it.
- A certificate's profile is only its preset: what it contains is what
  its version allowed, and the version says so.
- Migrating today's profiles is behaviour-preserving and comes first.
