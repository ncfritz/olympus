# 0038. Harpocrates: the key types a CA may have

- **Status:** Accepted
- **Date:** 2026-10-14; accepted 2026-10-14 (Neil)
- **Amends:** [ADR 0033](0033-harpocrates-key-types-and-imported-keys.md)
  (A CA's key is not affected)

## Context

ADR 0033 lets the operator choose a certificate's key type at issuance,
from everything the signer generates, but leaves a CA's key as ADR 0020
had it: P-256, or RSA 2048. Creating a root is where that shows: the new
root page offers the issuance form's key choice, and a CA's is the
shorter list.

Some relying parties want a CA of a larger curve or a longer RSA key
than a leaf's: a policy that asks for P-384 throughout a chain, or
hardware that takes RSA but wants more than 2048 bits from whatever it
trusts. A root lives twenty years, so its key is the one most worth
making larger.

The signer already generates every one of these and signs with any of
them: only the service's list of a CA's key types stood in the way.

## Decision

**A CA's key may be P-256, P-384 or P-521, or RSA 2048, 3072, 4096 or 8192.** P-256 stays the default. It is chosen when the CA is created,
roots, intermediates and issuing CAs alike, and is the CA's for life: a
successor may choose again.

**DSA and Ed25519 stay leaf-only.** A DSA CA is refused by browsers and
current OpenSSL, and TLS 1.3 has no DSA at all; an Ed25519 CA is not
accepted by browsers and by few other relying parties yet. Either would
make a hierarchy that much of what it is for could not use.

A CA signs as it does today, whatever its key: SHA-256 for the
certificates it signs (or the hash a profile version chooses, ADR 0034)
and for its revocation lists and OCSP responses.

## Consequences

- The console's key choice for a CA (a new root, and the CAs a ceremony
  creates) offers these; the issuance form keeps the longer list.
- A P-384 or P-521 CA signs with SHA-256 unless a profile version asks
  for more: valid, but not the usual pairing of curve and hash (SHA-384,
  SHA-512). Matching the hash to a CA's curve by default is a separate
  change, if a relying party needs it.
- An RSA 8192 CA takes the signer seconds to tens of seconds to
  generate, and makes every signature, list and OCSP response it signs
  slower and larger; for an offline root that signs rarely, that is
  little.
- A relying party that cannot verify a CA's key type cannot use
  anything beneath it: choosing past P-256 is choosing who can.
