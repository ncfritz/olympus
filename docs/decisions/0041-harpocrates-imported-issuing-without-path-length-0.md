# 0041. Harpocrates: an imported issuing CA without path length 0 signs its lists only

- **Status:** Accepted
- **Date:** 2026-10-15; accepted 2026-10-15 (Neil)
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md) (issuing
  CAs with path length 0), [ADR 0037](0037-harpocrates-xca-imported-for-the-record.md)
  (issuing CAs imported closed, with their keys)

## Context

ADR 0020 makes every online issuing CA a CA with path length 0, and the
signer refuses to hold an issuer key for any other: a key the signer
holds online can then sign no CA that validates, whatever happens to it.

XCA's issuing CAs were not made to that rule: their certificates often
carry no path length at all. ADR 0037 imports them closed, their keys in
the signer to sign their revocation lists, and ADR 0039 requires the key.
The path length rule refuses them, so they cannot be imported.

## Decision

- **An imported issuing CA whose certificate does not say path length 0
  is accepted only closed**, and the signer registers it **lists only**:
  it signs that CA's revocation lists and its OCSP responder's
  certificate, and refuses to sign any other certificate with it. The
  guarantee ADR 0020 wanted holds at the signer for these keys: whatever
  asks, they sign no CA and no leaf.
- **An open issuing CA still has path length 0**, made here or imported,
  as ADR 0020 has it.
- The CA's record keeps the path length its certificate says (none, for
  most of XCA's), rather than 0.

## Consequences

- XCA's issuing CAs import as ADR 0037 intended, whatever their path
  length, and keep publishing their lists from Harpocrates.
- Such a CA can never be opened to issue again: issuing from it would
  need the signer to sign a certificate with a key whose certificate
  allows CAs beneath it. Its successor is a CA made here.
- The signer's store gains a column: an issuer is lists only, or not.
