# 0039. Harpocrates: XCA's certificates imported with their keys and CSRs

- **Status:** Accepted
- **Date:** 2026-10-14; accepted 2026-10-14 (Neil)
- **Amends:** [ADR 0037](0037-harpocrates-xca-imported-for-the-record.md)
  (What they issued, imported as a record)

## Context

ADR 0037 imports what XCA's CAs issued as a record: each certificate,
its key's public half, and an enrollment of mode `imported`, the key
recorded with the subscriber (`location: subscriber`). XCA keeps more
than that for many of them: the private key, where XCA generated it,
and the CSR it was certified from. Once XCA is archived, those are
somewhere else, and a certificate's key and request are what is wanted
on the day it is renewed with the same key, re-deployed, or looked into.

The pieces are already here: the signer imports a key as encrypted
PKCS#8 or PKCS#12, with its passphrase used once (ADR 0033), and keeps
it escrowed, exportable again (ADR 0032, escrow); an enrollment holds
its CSR.

## Decision

### A certificate may be imported with its key, and its CSR

`POST /certificates/import` takes, beside the certificates, one key
(`key`: encrypted PKCS#8 or PKCS#12 and its passphrase, as issuance
takes one) and, only with a key, one CSR (`csr`, PEM):

- **The key goes to the signer, escrowed.** The signer decrypts it and
  keeps it as it keeps a generated one; its record is
  `location: signer`, not exported once. From then on it is an escrowed key like
  any other: exported again, reused by a renewal while it is young
  enough, deployed, and destroyed with its lineage's last valid
  certificate or when revoked for keyCompromise.
- **It must be one of the certificates'.** The key belongs to the
  certificate in the request with the same public key; a key that is
  none of theirs is refused, and the signer forgets it.
- **A CSR comes with its key.** It is refused without one, and
  refused unless it is signed by that key (its public key the key's,
  its signature valid). It is kept on the certificate's enrollment, as
  a CSR enrollment's is.
- **Only where the profile allows a key to be held.** As at issuance
  (ADR 0033), a profile that takes CSRs only keeps its keys with the
  subscriber: a key brought under it is refused.
- **Not for a revoked certificate.** Escrow keeps a key while its
  lineage has a valid certificate; a key for a revoked one is refused
  rather than kept and destroyed.

### A certificate already imported gains its key

Importing again skips a certificate already here (ADR 0037). With a
key, it does not: a certificate already recorded with its key at the
subscriber is given the key (and the CSR, if its enrollment has none),
so XCA's certificates imported as a record can be completed afterwards,
one at a time, without importing them again. The response says which
certificates were imported and which gained their key.

### From the certificate's page

A certificate imported as a record is completed from its own page too,
without importing it again:

- `POST /certificate/{id}/key` gives it its key (and, optionally, its
  CSR), as above.
- `POST /certificate/{id}/csr` gives it its CSR alone, once its key is
  escrowed and while it has none: a CSR still comes with its key, here
  one already kept.

Only a certificate imported from another CA product (enrollment mode
`imported`) takes either: one issued here already has its key where its
enrollment put it, and its CSR if it had one. A certificate says how it
was enrolled (`enrollmentMode`) and whether its CSR is kept (`hasCsr`),
so the page offers only what applies.

### Audited

The key's import is audited (`key.imported`, with the certificate and
its enrollment), as a key brought at issuance is; a CSR added alone, as
`certificate.csr-added`.

### The console

The import's certificates step takes, beside many certificates as a
record, one certificate with its key (PKCS#8 or PKCS#12, and its
password) and, optionally, its CSR. An imported certificate's page
offers "Add its key" while its key is with the subscriber, and "Add its
CSR" once the key is escrowed and the CSR is not kept.

## Consequences

- After XCA is archived, its certificates' keys and requests are in
  Harpocrates, escrowed and audited, rather than in its database.
- More keys in the signer: a compromise of the signer exposes them, as
  it exposes every escrowed key.
- A key is imported one certificate at a time: XCA exports each key
  with its own password, and a key matched to the wrong certificate is
  worse than one not imported.
- A key that a certificate imported as a record never had (XCA kept
  only the CSR, the subscriber kept the key) stays with the
  subscriber, as before.
- A key the signer has held before (one released after issuance) is
  refused by the signer, as at issuance.
