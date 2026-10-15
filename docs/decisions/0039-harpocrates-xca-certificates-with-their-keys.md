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

### A CA's CSR

An XCA CA is imported with the CSR its certificate was issued from, if
there is one (`POST /issuers/import`, `csr`): refused unless it is
signed by the key the certificate certifies, and kept as a CA created
here keeps its own. An issuing CA still comes with its key (ADR 0037);
a CA's CSR does not need one, since the certificate already names the
key. A CA imported without its CSR is given it afterwards from its page
(`POST /issuer/{id}/csr`), checked the same way, while it has none; a CA
says when it was imported (`importedAt`), so its page offers this only
for XCA's CAs.

### Keys read before they are taken

The signer refuses for good a key it has held, so a key is checked
against its CSR and certificate before an import hands it over:
`POST /keys/read` has the signer decrypt it and say its public key,
keeping nothing. The console's import of a CA reads the key first and
shows a key, CSR and certificate that do not match before anything is
sent to be kept.

### Audited

The key's import is audited (`key.imported`, with the certificate and
its enrollment), as a key brought at issuance is; a CSR added alone, as
`certificate.csr-added` (`issuer.csr-added` for a CA's).

### The console

Each import is one certificate, in a dialog on the page it belongs to:

- **The roots page** imports a root: its certificate, its ID, number
  and generation, and optionally its CSR.
- **A root's or an intermediate's page** imports a CA beneath it, in
  steps: its key (encrypted PKCS#8 and password; skipped for an
  intermediate, whose key stays offline, but an issuing CA's is
  required), its CSR (optional), then its certificate, with its ID,
  number, generation and tier, and for an issuing CA its purpose,
  longest certificate, extended key usages and whether it is closed. A
  key, CSR and certificate that do not belong together are shown as
  such at the step that finds it.
- **An imported CA's page** imports its CSR while it has none, and
  XCA's newest revocation list until one has been imported (lists
  signed here do not take its place).
- **An issuing CA's page** imports a certificate it signed ("Import
  leaf"): the certificate, the profile it is taken as issued under, and
  optionally its key (PKCS#8 or PKCS#12) with its password and, with
  the key, its CSR. Only a certificate that CA signed is taken
  (`issuerId`).
- **The certificates list** imports the same way, from whichever CA
  here signed it.

A key or CSR left out is added later from the certificate's page: "Add
its key" while its key is with the subscriber, and "Add its CSR" once
the key is escrowed and the CSR is not kept. Importing many
certificates at once, as a record, stays with the API and the CLI.

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
