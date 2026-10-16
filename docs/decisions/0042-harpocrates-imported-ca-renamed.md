# 0042. Harpocrates: an imported offline CA's ID may be corrected

- **Status:** Accepted
- **Date:** 2026-10-15; accepted 2026-10-15 (Neil)
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md) (Naming),
  [ADR 0037](0037-harpocrates-xca-imported-for-the-record.md)

## Context

Each CA has a slug, its ID (ADR 0020, Naming). A CA made here takes it
from its name; one imported from XCA is given it at import (ADR 0037),
typed or guessed from its certificate, and a wrong one is easy to give
and has been. Nothing changes a CA's ID, and nothing should change most
of them: the ID is in the URLs of its revocation list and certificate
(`/crl/<slug>.crl`, `/ca/<slug>.crt`), and every certificate it signs
here carries those URLs for as long as it is valid. The signer holds an
online CA's key under it too.

An imported CA is different until it signs something here: what XCA
issued under it names XCA's URLs, which are whatever XCA was set up
with, not its slug here.

## Decision

An admin may change the ID of a CA **imported from another CA product**
(`importedAt` set) that is **offline** (a root or an intermediate) and
whose slug **nothing names**: `POST /issuer/{issuerId}/rename`, with the
new ID, which follows the same rule as an import's.

- **Nothing names it.** Refused while a certificate the CA signed (a
  certificate recorded under it, a CA beneath it, its OCSP responders')
  carries its list or certificate URL under the old ID: those must keep
  resolving. In practice this is a CA imported with a wrong ID and
  corrected before it signed anything here.
- **Not an issuing CA.** The signer registers an online CA's key under
  its ID; renaming that is not supported.
- **Everything follows it.** Its record and everything that references
  it (its lists, certificates, the CAs beneath it, profiles pinned to
  it, ceremonies, OCSP) take the new ID in one transaction, and its list
  and certificate URLs are made from it.
- **Published under the new name.** Its list and certificate files move
  to the new ID's names; if they cannot, its newest list is published
  again, under the new name, by the next publication run.
- **Audited** as `issuer.renamed`, under the new ID, with the old one.
  Earlier events keep the ID the CA had when they were recorded; the
  audit chain is never rewritten.

## Consequences

- A CA imported with a wrong ID is corrected in place, without
  discarding and importing it again (which its unique subject would
  refuse).
- The old ID's URLs stop resolving. Nothing names them, by the rule
  above; a bookmark or a hand-written note might.
- An issuing CA imported with a wrong ID still cannot be corrected.
