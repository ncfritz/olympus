# 0032. Harpocrates: new roots, three shapes, and a migration from XCA

- **Status:** Proposed
- **Date:** 2026-10-09
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md)

## Context

ADR 0020 adopts XCA's hierarchy: the root, both intermediates and the
Service and Device CAs are imported with their keys, everything XCA
issued is recorded, and XCA is retired in one cutover (plan phase 4). The
cutover was built but has not been run, and a different approach is now
wanted:

- **Leave XCA in place** and let it fade. New certificates come from
  Harpocrates; what XCA issued is replaced, by ACME where the holder
  speaks it and by reissue from the new CAs where it does not, and XCA
  is deprecated once nothing depends on it. A migration, not a cutover.
- **More than one root.** One for the platform (servers, services,
  devices, identities, signing), one for development and testing (and
  possibly what `scripts/dev-ca.sh` provides today), and one for a
  bespoke consumer that requires a specific root of its own.
- **That bespoke root has a shape ADR 0020 does not allow.** EC
  `prime256v1` keys and `ecdsa-with-SHA256`; the root signs the
  certificates directly, with no intermediate; the root carries basic
  constraints and key usage, its leaves only the subject and authority
  key identifiers. It signs rarely, and generates the keys it certifies.
- **Defaults are not decisions.** ADR 0020 fixes each tier's validity,
  path length and naming. Each new root, intermediate and issuing CA
  should start from the recommended settings and let the operator review
  and change them before anything is signed.
- **Escrow wherever the key is generated.** ADR 0020 escrows only for
  the profiles that need it (devices, mail).
- **The console first.** Each phase should be exercised through the
  console as it is built, rather than through the API and the CLI.

## Decision

### No import from XCA in production

Harpocrates starts empty in production and creates its own roots. XCA
keeps its CAs, and the certificates they issued, until the migration
(below) has replaced them; Harpocrates does not record them. The import
commands stay, for the dev CA and for CAs Harpocrates does not create;
the cutover guide and its ceremony plans are withdrawn.

This replaces ADR 0020's statement that the existing root and
intermediates are imported "so XCA is retired without a new root or
anything reissued", the Hierarchy table's "existing; imported" rows, and
Issuing CA 1 and 2 being imported closed.

### Several roots, each a trust anchor of its own

A root anchors only what is beneath it; trusting one says nothing of
another. Three are planned:

| Root      | Shape       | For                                                                                                                                   |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Primary   | three tiers | Everything the platform runs on: servers (internal hosts, ACME, services' listeners), service and device identities, signing          |
| Dev       | three tiers | Development and testing, in the production Harpocrates: dev profiles, dev names only, short lives; trusted by the dev API, never prod |
| [Signing] | direct      | The bespoke consumer: signs its certificates directly, in ceremonies                                                                  |

The Dev root lives in the production instance so that development uses
the real CA, the real ceremonies and ACME; its issuing CAs are
name-constrained to development names, and the production relying
parties never trust it. Automated tests keep `scripts/dev-ca.sh`'s
throwaway CA, since they cannot depend on the production instance.

Under the Primary root, listeners' server certificates (the API's `3443`,
the agents' listeners) come from an issuing CA of their own, apart from
the Service CA that issues client identities and from the
name-constrained TLS CA that ACME uses. That is the split `main` already
checks (`stack.sh check`, `TLS_SERVER_ISSUER`), and it keeps Docker
service names out of the TLS CA's constraints. The intended layout,
before any name is chosen:

```
Primary root                                   offline
├── Intermediate (servers)                     offline
│   ├── TLS issuing CA                         internal hosts, ACME; name-constrained
│   └── Server issuing CA                      services' listeners
└── Intermediate (identities and signing)      offline
    ├── Service issuing CA                     service client certificates
    ├── Device issuing CA                      people's devices
    └── Signing issuing CA                     code, mail, documents
```

**No names are fixed by this ADR.** Each is chosen, and reviewed, when
the CA is created (below).

### Three shapes

A root records its shape when it is created, and its ceremonies offer
only what that shape allows.

| Shape       | Root path length | A ceremony with the root signs | Below it                                      |
| ----------- | ---------------- | ------------------------------ | --------------------------------------------- |
| Three tiers | 2                | intermediates; its list        | offline intermediates, which sign issuing CAs |
| Two tiers   | 1                | online issuing CAs; its list   | online issuing CAs, which sign leaves         |
| Direct      | 0                | leaves, with keys it generates | nothing; leaves only                          |

- A **direct** root's ceremony generates each leaf's key in the signer,
  signs the certificate with the root, and hands back the key, encrypted,
  and the certificate; the key is escrowed by default (below). This is
  the one place a ceremony signs a certificate that is not a CA, and only
  for a root whose shape is direct.
- Its leaves are built from a profile that can name **exactly** the
  extensions they carry: for the bespoke root, the subject and authority
  key identifiers and nothing else. The root itself keeps basic
  constraints and key usage, as every CA does.
- A leaf that names no distribution point cannot be checked for
  revocation. Revoking one records it in Harpocrates and the audit log;
  whatever trusts it must be told separately.

### Names and settings: recommended defaults, reviewed and overridable

Creating a root, an intermediate or an issuing CA shows every setting
with its default and the reason for it, and each may be changed before
anything is signed:

- **The subject.** Built from an organisation (O, and the start of the
  CN), an optional purpose (`Dev`), the tier, a number and a generation,
  as ADR 0020's naming does; the organisation and purpose are now per
  root rather than one for the whole CA, and a root may have a purpose.
  The subject can also be written outright (OU, C, any attribute). It
  must differ from every subject Harpocrates has issued.
- **Validity, key, path length, key usage, extended key usage, name
  constraints, distribution and issuer URLs, the list's validity.**
  ADR 0020's values become the defaults: 20, 10 and 5 years by tier;
  P-256 and `ecdsa-with-SHA256`; path lengths from the shape; 13-month
  lists for offline CAs and 7-day lists for online ones.
- **The invariants are not settings.** A CA without certificate signing,
  a child outliving its parent, a path length its parent forbids or an
  extended key usage its parent does not permit is refused with the
  reason, by the signer whatever the service asks.
- What was changed from the default is recorded in the audit log beside
  the CA.

### Escrow for every generated key

Every profile has an escrow setting, on by default, for any leaf whose
key Harpocrates generates; a profile also says whether one certificate
may override it. ADR 0020's handling of escrowed keys is unchanged (an
admin, a reason, a recent sign-in, the audit log, deletion with the
lineage). Keys that arrive as a CSR are never held, as before.

### Bootstrap and a new root

- The signer is initialised from the console as well as from its
  container: the recovery passphrase is set there, the unseal key is shown
  once, and the console confirms the signer unseals itself after the
  restart.
- A new root's key leaves once, encrypted. Before the root signs
  anything, the operator gives the key back from the offline media: that
  **proves the backup** and opens the root's first ceremony. A root that
  has signed nothing can be discarded.
- A root's first revocation list is signed in its first ceremony, and
  its certificate and list are published before anything beneath it is.

### The migration from XCA, later

The console comes first, then renewal and ACME (ADR 0020's order), and
the migration after them, as its own phase:

- Relying parties trust the Primary root alongside XCA's root for its
  duration; the API's `AUTH_SERVICES_ISSUER` and `TLS_CRL_SERVICES`
  name the Service issuing CAs of both (ADR 0023 already allows two
  issuers during a rollover).
- Each XCA certificate is replaced: by ACME where its holder speaks it,
  otherwise reissued from the new CAs by hand or through a deploy
  target.
- XCA keeps publishing its own lists until it is retired, when nothing
  trusts a certificate it issued: its root is then removed from the
  trust stores, and its database archived.

## Consequences

- Nothing is imported or adopted; the cutover's risk (a missed
  certificate, a wrong CRL number) goes away, at the price of reissuing
  everything XCA issued and installing a new root on every device.
- Two roots are trusted during the migration, and the inventory of what
  still chains to XCA lives outside Harpocrates.
- The signer gains: ceremonies with a two-tier root (signing issuing
  CAs) and with a direct root (signing leaves, generating their keys);
  leaf profiles with an exact extension list; and the root's shape and
  per-root naming as inputs.
- The service and API gain: overrides on every create request, checked
  and audited; initialise; discard of an unused root; a root's first
  list in its first ceremony; escrow as a profile setting.
- The console is built before renewal and ACME, and covers the
  bootstrap, roots and ceremonies first.
- Development can use real certificates from the Dev root, with ACME,
  while tests stay on the throwaway dev CA.
- From ADR 0020, these no longer hold: XCA retired at phase 4; the
  existing CAs keep their names; Issuing CA 1 and 2 imported closed;
  "XCA is retired" in its Consequences; the TLS CA's successor relation
  to Issuing CA 2. The rest of ADR 0020 stands.

## Open

- The names of the three roots and of everything beneath them, chosen
  when each is created.
- What the bespoke consumer requires beyond the extensions: validity,
  subject layout, key file format.
- Whether the Dev root replaces `scripts/dev-ca.sh` for anything
  long-lived (a developer's laptop listener, the iOS tester).
- How devices learn the new root: a configuration profile for iOS, the
  System keychain on laptops, DSM's store on the NAS.
