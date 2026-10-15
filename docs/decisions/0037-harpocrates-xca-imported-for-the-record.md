# 0037. Harpocrates: XCA's CAs imported, as a record and to revoke

- **Status:** Accepted (amended by [0039](0039-harpocrates-xca-certificates-with-their-keys.md), [0040](0040-harpocrates-imported-hierarchy-free-form.md))
- **Date:** 2026-10-12; accepted 2026-10-12
- **Amends:** [ADR 0032](0032-harpocrates-roots-and-migration.md) (No
  import from XCA in production; the migration from XCA, later)

## Context

ADR 0032 starts production Harpocrates empty: XCA keeps its CAs and
what they issued until the migration has replaced them, and "the
inventory of what still chains to XCA lives outside Harpocrates". The
import commands stay only for the dev CA and for CAs Harpocrates does
not create.

Two things are wanted that this leaves out:

- **A record.** XCA's CAs and certificates are the platform's history:
  what was issued, by which CA, when, and what replaced it. Kept only in
  XCA's database, that history ends when XCA is archived, and the
  migration's inventory is a spreadsheet beside Harpocrates rather than
  the lineages and dashboard it already has.
- **Invalidating as the migration goes.** Each XCA certificate replaced
  should be revoked once its successor is in place, and each XCA CA once
  nothing it signed is left, so that a lost or forgotten one stops being
  trusted before XCA's root leaves the trust stores. Doing that in XCA,
  by hand, alongside Harpocrates, is two systems to keep in step.

The import itself was built for the withdrawn cutover (ADR 0020) and
still works: `POST /issuers/import`, `/certificates/import` and
`/issuer/{id}/crls`, and the CLI's `import-issuer`,
`import-certificates` and `import-crl`. Only the API and the CLI drive
it; the console offers nothing.

## Decision

### XCA's CAs may be imported into production, closed

ADR 0032's "No import from XCA in production" is replaced by this:

- **Roots and intermediates** are imported by their certificate alone.
  Their keys stay where XCA keeps them (its database, the offline
  media); Harpocrates never holds them.
- **Issuing CAs** are imported **closed**, with their key (encrypted
  PKCS#8, as XCA exports it) going to the signer. A closed CA signs its
  revocation lists and nothing new: no profile issues from it, and
  renewal and ACME never pick it.
- **What they issued** is imported under the profile each certificate
  is taken as issued under. It is a record: it appears in the
  certificates list and its lineage, and renewing one issues its
  successor from that profile's CA in the new hierarchy, never from
  XCA's. That is the migration's replacement, done from the record.
- **XCA's newest lists** are imported before Harpocrates signs any for
  a CA, so numbers continue from them and their revocations carry into
  every list after. From then on Harpocrates publishes each imported
  issuing CA's lists, and XCA stops publishing them: one publisher per
  CA.
- XCA's CAs stay under their own root, imported parents first (the
  import checks each CA against its parent). Nothing imported is
  re-signed, renamed or placed beneath the new roots; the Roots page
  shows XCA's root as a root of its own, beside the new ones.

The console imports all of it (a CA, the certificates it issued, its
lists), with files dropped or chosen as well as pasted, so that the
import is not a matter of the CLI and a terminal in the container.

### Invalidating them

- **XCA's certificates** are revoked from Harpocrates once imported:
  their issuing CA's key is in the signer, so its next list carries the
  revocation, as for any certificate.
- **XCA's CAs** are revoked by their parent's list. Revoking a CA is
  the follow-up phase 3 left open (`POST /issuer/{id}/revoke`, the
  parent's next list carrying it); it is built in the migration (plan
  phase 8). For an offline parent (XCA's root or an intermediate), that
  list is signed in a ceremony with the parent's key file brought from
  the offline media, as for the new roots; or signed in XCA and
  imported, while XCA still runs.

### The migration, otherwise unchanged

ADR 0032's migration stands: both roots trusted for its duration, each
XCA certificate replaced by ACME or reissue, XCA retired once nothing
trusts what it issued. What changes is that its inventory is
Harpocrates's own record, and that each replaced certificate (and in
the end each XCA CA) is revoked there.

## Consequences

- XCA's history outlives XCA: its CAs, certificates and revocations are
  in Harpocrates, audited, in the certificates' lineages and on the
  dashboard, after its database is archived.
- The migration's inventory is the certificates list filtered to XCA's
  CAs; its progress is their certificates replaced and revoked.
- XCA's issuing CA keys go into the signer, closed. They sign lists
  only; a compromise of the signer now also exposes them, which it
  would have under ADR 0020's cutover too.
- Importing XCA's CAs and certificates is a second risk ADR 0032 had
  removed (a missed certificate, a wrong list number), now taken on for
  the record rather than to keep anything running: a missed certificate
  is a gap in the record, not an outage, and XCA's last list is
  imported before Harpocrates signs one.
- The dashboard and alerts count XCA's certificates once imported:
  their expiry is the migration's deadline, which is wanted.
- The console gains an import for CAs, certificates and lists; the
  drag-and-drop file inputs serve the rest of the console too (a CSR,
  a key, a certificate).
- From ADR 0032, these no longer hold: "No import from XCA in
  production"; "Nothing is imported or adopted" and "the inventory of
  what still chains to XCA lives outside Harpocrates" in its
  Consequences. The rest of ADR 0032 stands.

## Open

- Importing an issuing CA closed without its key, as a record only,
  when XCA's copy of a key is lost: it would sign nothing, and its
  lists would come from XCA until it is retired.
- XCA's root shown apart from the new roots on the Roots page (it is a
  trust anchor being retired, not one being built), once there is
  something to mark it by.
