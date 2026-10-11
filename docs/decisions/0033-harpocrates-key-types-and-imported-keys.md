# 0033. Harpocrates: the key type chosen at issuance, and keys brought in

- **Status:** Accepted
- **Date:** 2026-10-11; accepted 2026-10-11 (Neil)
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md)

## Context

ADR 0020 makes every key P-256 (after ADR 0018), RSA 2048 only where a
device needs it, and has the profile decide the key type: a generated
key is the profile's type and a CSR of another type is refused. Its two
enrollment modes are a CSR, or a key the signer generates.

Neither holds up for the clients Harpocrates is meant to replace XCA
for. Some hardware takes only RSA, some of it larger than 2048 bits;
some old clients take DSA; Ed25519 and the larger curves are wanted for
newer ones. And a key that already exists (made on a device, or kept
from XCA) can only be certified by making a CSR from it, which some
devices cannot do and an operator holding just the key file has no tool
for in Harpocrates.

## Decision

**The operator chooses the key type at issuance.** A profile's key type
becomes its default, not a rule:

- The signer generates RSA 2048, 3072, 4096 and 8192; DSA 2048 and 3072;
  P-256, P-384 and P-521; and Ed25519. A request names one; without one
  it gets the profile's.
- A CSR may be of any type Harpocrates certifies: RSA or DSA of at least
  2048 bits, a NIST curve (P-256, P-384, P-521), or Ed25519. ACME
  finalisation takes the same.
- A renewal that rekeys a generated key generates the same type as the
  key it replaces.
- **DSA is included knowingly.** TLS 1.3 has no DSA, and browsers and
  current OpenSSL defaults refuse DSA certificates; the console warns
  when it is chosen. It is for the clients that still need it.
- **A CA's key is not affected**: P-256, or RSA 2048, as before.

**A key may be brought in** (a third enrollment mode, recorded as
`imported`), where the profile allows a generated key: a profile that
takes only CSRs keeps keys with their subscribers.

- It comes as encrypted PKCS#8 (PEM) or a PKCS#12 file, with its
  passphrase. Only the key is used: a PKCS#12 file's certificates are not
  kept. The passphrase is used once and never stored.
- The signer imports it as it imports any key, wrapped by its own data
  key. Escrowed (the profile's setting, or the request's where the
  profile allows), it is kept and exported again like a generated key.
  Not escrowed, the signer forgets it once it is certified, and only the
  subscriber has it; it renews from its public key while it is young
  enough.
- The signer refuses a key it has held before, destroyed or not, so a
  key that was brought in and forgotten is not brought in again.

## Consequences

- The issuance form chooses where the key comes from (generate, import,
  or a CSR) and, for a generated key, its type and size or curve.
- A profile no longer guarantees its certificates' key type. Anything
  that relied on that (none does today) has to read the certificate.
- A profile's key usages are applied as they are, whatever the key: an
  EC or DSA key under a profile with `keyEncipherment` (`legacy-device`,
  `email`) carries it, though RFC 5480 says an EC key should not. The
  seeded `email` profile already does this with its P-256 keys; making
  key usages follow the key type is a separate change.
- RSA 8192 takes the signer seconds to tens of seconds to generate; the
  service waits up to three minutes for it.
- Web Crypto has no DSA, so the service verifies a DSA CSR's signature
  with Node's crypto.
