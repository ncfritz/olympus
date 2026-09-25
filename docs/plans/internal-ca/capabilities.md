# Harpocrates: capabilities, surfaces and the console

Status: **decided** (2026-09-25); recorded in ADR 0020, which is the
authority where the two differ. This reconciles what Harpocrates
exposes, and to whom, before the console is designed and before ADR 0020
is accepted. It amends ADR 0020 where marked **(amends 0020)**; the
decisions it asks for are at the end.

## Three kinds of caller

| Surface        | Who                                        | Shape                                                |
| -------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Console**    | The operator, a person                     | Olympus Control, `/harpocrates/ca` (amends ADR 0021) |
| **API**        | The console, scripts, the break-glass CLI  | `/v1/...`, OpenAPI `harpocrates`, JWT, `pki-*` roles |
| **Automation** | Machines, and Harpocrates's own schedulers | ACME, `/v1/renew` over mTLS, schedules; no person    |

Everything the console does is an API operation first: the console has no
private backdoor, so anything done by hand can be scripted. Automation is
the part with no person in the loop, and it gets no screens beyond status
and audit.

**The console (amends 0020 and 0021; decided D1).** ADR 0020 put a PKI
area in `apps/site`; ADR 0021 (accepted after it) listed the CA as an
Olympus console at `/olympus/ca`. Instead, Harpocrates is a **property**
of Olympus Control, like Dionysus and Minerva, with its own sidebar group:

| Console | Path              | API                   | Image                    |
| ------- | ----------------- | --------------------- | ------------------------ |
| CA      | `/harpocrates/ca` | `/harpocrates/ca/api` | `harpocrates-ca-console` |

on `control.olympus.ncfritz.net` (`CONTROL_HOST`, ADR 0021), which stays
the suite's one host. The console is where operators' tools live, and the
CA must not depend on the site to be managed. It lives in
`apps/harpocrates/console`, beside the service and the signer, rather than
`apps/harpocrates-console` (ADR 0021's rule for apps without an agent),
because it is built and deployed with them. The property leaves room for
later consoles (SSH, discovery) without crowding one.

ADR 0021 is amended in two places, recorded in ADR 0020 when it is
accepted: the properties table (Harpocrates added, "CA" removed from
Olympus) and "where a console lives" (a console built with its service
sits in that service's directory).

## Who does what

`C` console, `A` API, `M` automation. **Bold** is where it mostly happens.

| #   | Capability                             | C         | A     | M     | Notes                                                              |
| --- | -------------------------------------- | --------- | ----- | ----- | ------------------------------------------------------------------ |
| 1   | Create a CA (root or intermediate)     | **✓**     | ✓     |       | A ceremony: rare, deliberate, guided                               |
| 1a  | Plan a successor CA (rollover)         | **✓**     | ✓     | ✓     | Automation warns when an issuing window is closing                 |
| 2   | Request a certificate from a profile   | **✓**     | ✓     | ✓     | ACME and renewal are the machine paths                             |
| 2a  | Submit a CSR                           | ✓         | **✓** | ✓     | Pasted or uploaded in the console; ACME `finalize`                 |
| 2b  | Produce a CSR (for an external CA)     | **✓**     | ✓     |       | Only for a CA whose parent is outside Harpocrates                  |
| 3   | Generate a key                         |           |       | **✓** | Never an action; a consequence of "generate for me"                |
| 4   | Sign (issue)                           | **✓**     | ✓     | ✓     | Issuer from the profile's pin, overridable within the rules        |
| 5   | Revoke                                 | **✓**     | ✓     | ✓     | ACME `revokeCert`; a revoked CA revokes nothing below it by itself |
| 6   | Issuer configuration (CRL, URLs)       | **✓**     | ✓     |       | Rare                                                               |
| 6a  | Certificate delivery (formats, deploy) | ✓         | ✓     | **✓** | Downloads by hand; deploy targets run on issue and renewal         |
| 7   | Audit                                  | **✓**     | ✓     | ✓     | Read-only; every surface writes to it                              |
| —   | CRL signing and publication            | status    | ✓     | **✓** | Daily and on revocation (ADR 0020)                                 |
| —   | Renewal                                | ✓         |       | **✓** | `/v1/renew` over mTLS; "renew now" by hand                         |
| —   | ACME accounts, EAB, name policy        | **✓**     | ✓     |       | The protocol itself is automation                                  |
| —   | Seal, unseal                           | **✓**     | ✓     | ✓     | Automatic unseal at start; the console shows the state everywhere  |
| —   | Expiry monitoring and alerts           | dashboard | ✓     | **✓** | Prometheus `certificate_expiry_days`, alerts                       |
| —   | SSH user and host certificates (8)     | **✓**     | ✓     | ✓     | Hosts renew over mTLS; users request with a public key             |
| —   | Dashboard, deployed vs issued (9)      | **✓**     | ✓     | ✓     | The probe is automation; the dashboard is the console's front page |
| —   | Import from XCA                        |           | ✓     |       | CLI, once, during the cutover ceremony                             |

## 1. Certificate authorities

### The hierarchy, as it is

XCA holds three tiers today ([the certificates
guide](../../guides/certificates.md)): `ncfritz.net Root CA 1`, two
intermediates that sign only CAs, and issuing CAs with path length 0
beneath them. Harpocrates keeps that shape; ADR 0020's Hierarchy section
has the tree, with where the new TLS and Signing CAs go.

| Kind             | Key                                               | Signs                                 | Path length |
| ---------------- | ------------------------------------------------- | ------------------------------------- | ----------- |
| **Root**         | Offline: in the signer only during a ceremony     | Intermediates, cross-signs, its list  | 2           |
| **Intermediate** | Offline, likewise                                 | Issuing CAs, its list                 | 1           |
| **Issuing**      | Online, in the signer's store                     | Everything else                       | 0           |
| **External**     | An issuing CA whose parent is outside Harpocrates | As issuing; its CSR goes out, cert in | 0           |

**Creating a CA in the console** is a wizard: tier, parent, name
(below), key type, validity (bounded by the rules below), name
constraints, allowed extended key usages, and the distribution URLs it
will write. A CA whose parent is offline is signed in a ceremony; one
whose parent is outside Harpocrates ends at a CSR to download and
resumes at "import the signed certificate", `pending` in between.

### Offline CAs and ceremonies (decided D2; amends 0020)

Harpocrates creates and holds roots and intermediates, and so replaces
XCA entirely, but a CA that signs CAs is never online. Its key lives
outside the signer except during a **ceremony**, and a ceremony is the
only time anything is signed with it.

| State      | The key                                                       | Can sign                   |
| ---------- | ------------------------------------------------------------- | -------------------------- |
| `ceremony` | In the signer, imported for this ceremony                     | CAs below it, its own list |
| `offline`  | Encrypted PKCS#8 on offline media and in the password manager | Nothing                    |

- **Creating an offline CA** is a ceremony: the signer generates the
  key, signs (or self-signs, for a root), exports it encrypted under a
  passphrase entered for this purpose (never the recovery passphrase),
  and destroys its copy. The console does not leave the ceremony until
  the operator confirms the export is stored; the audit records each
  step.
- **A ceremony** imports one offline CA's key, signs what the operator
  lists (an issuing CA, its list, a cross-signed successor) and destroys
  the key again, whether it succeeds or not. The signer holds it for one
  ceremony at most, an hour at most, and never across a restart.
- **`CA:TRUE` is signable only in a ceremony**, with a path length below
  the signer's own: an online key never signs a CA.
- **The offline CAs' lists** are signed in ceremonies, 13 months at a
  time; the automation alerts two months before one lapses, since a
  lapsed list breaks every relying party beneath it. That makes a
  ceremony a yearly event at least (the root and both intermediates'
  lists together).
- **The existing root and intermediates** are imported as offline CAs
  (their keys from XCA as encrypted PKCS#8, what they issued and their
  CRL numbers with them), so retiring XCA needs no new root and nothing
  reissued. The XCA database is kept as an archive.
- Development hierarchies (the dev CA) use the same flow, with the
  exported keys kept beside them in `infra/dev-ca/`.

### Naming

XCA's names already follow a pattern (`ncfritz.net Issuing CA 2 - G1`,
`ncfritz.net Service Issuing CA 1`); the convention makes it regular
rather than replacing it:

| Part       | Rule                                                                         | Example                             |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| `CN`       | `ncfritz.net [<purpose>] <tier> CA <n> - G<generation>`                      | `ncfritz.net TLS Issuing CA 1 - G1` |
| tier       | `Root`, `Intermediate`, `Issuing`                                            |                                     |
| purpose    | What an issuing CA is for: `TLS`, `Service`, `Device`, `Signing`, `SSH User` |                                     |
| `n`        | Tells apart CAs of the same purpose and tier                                 |                                     |
| generation | Counts successors: a successor keeps `n` and takes the next `G`              | `- G2`                              |
| `O`        | `ncfritz.net`                                                                |                                     |
| slug       | The same parts, lower case: the id in URLs and metrics                       | `tls-issuing-1-g1`                  |
| URLs       | `http://pki.internal.ncfritz.net/crl/<slug>.crl`, `/ca/<slug>.crt`           |                                     |

A subject is never reused, by a successor or after revocation: chain
building matches issuers by name first, so two CAs with one name break
clients in ways that are hard to see. The existing CAs keep their names;
one without a generation is its first. A successor's name differs, so the
API's `AUTH_SERVICES_ISSUER` (ADR 0023) lists both during a rollover.

### Longevity

A CA must outlive everything it signs, and a successor must exist before
its predecessor stops issuing. The **issuing window** is the part of a
CA's life in which a certificate of the longest validity it issues still
fits:

```
|--------------- CA validity ----------------|
|---- issuing window ----|--- max leaf ---|+m|
            ^ successor created   ^ stops issuing
```

| Tier                 | Validity | Successor created | Stops issuing                            |
| -------------------- | -------- | ----------------- | ---------------------------------------- |
| Root                 | 20 years | at 10 years       | when an intermediate would not fit       |
| Intermediate         | 10 years | at 6 years        | when an issuing CA would not fit         |
| Issuing              | 5 years  | at 3 years        | remaining life < max leaf validity + 30d |
| Leaf: `internal-tls` | 90 days  | —                 | —                                        |
| Leaf: others         | 1 year   | —                 | —                                        |

- The signer already refuses validity past its issuer's expiry; the
  service adds the issuing window, so a request near the end moves to the
  successor instead of getting a short certificate.
- A successor is created by hand (a ceremony, 1a); the automation alerts
  from the day the window has a year left, and the console shows each
  CA's window on its tree.
- A root's successor is cross-signed by the old root, so devices that
  have only the old root keep trusting what the new one issues. That is
  the one place cross-signing earns its keep here.

## 2. Requests, profiles and CSRs

A **profile** (ADR 0020) is what the user calls a template: issuer pin,
key type, key usage and extended key usage, subject and SAN rules,
validity, enrollment mode (CSR, generated, or both) and export formats.
The initial set, with the types asked for:

| Profile         | For                                | EKU              | Default issuer |
| --------------- | ---------------------------------- | ---------------- | -------------- |
| `service`       | Agents and services (mTLS clients) | client, server   | Service        |
| `api-server`    | The API's `3443`                   | server, client   | Service        |
| `device`        | People's devices                   | client           | Device         |
| `internal-tls`  | Internal hosts (nginx, NAS)        | server           | TLS            |
| `legacy-device` | The printer                        | server           | TLS            |
| `code-signing`  | Scripts, binaries, images          | code signing     | Signing        |
| `email`         | S/MIME: signing and encryption     | email protection | Signing        |
| `document`      | PDFs and other documents           | document signing | Signing        |

**The signing profiles (decided D3)** get their own issuer,
**ncfritz.net Signing Issuing CA 1 - G1**, under Intermediate CA 2,, whose certificate allows only those
three EKUs (RFC 9336's
`id-kp-documentSigning` for documents), so nothing it issues is valid for
TLS and nothing the TLS issuers issue can sign code or mail. Its name
constraints permit the owned mail domains for `rfc822Name`. Three things
differ from the TLS profiles:

- **S/MIME encryption keys are escrowed.** Losing one loses the mail
  encrypted to it, so `email` generates and escrows by default; a
  signing-only variant may take a CSR.
- **Signatures are refreshed before their certificates expire**
  (decided). Without a timestamp (RFC 3161), a signed binary or PDF
  stops verifying when its certificate expires, so signing profiles are
  2 years, the certificate is renewed at 18 months, and the expiry
  alert for a signing certificate says what it is for: re-sign what it
  signed. No timestamping authority for now; it would be a separate key
  and certificate (`id-kp-timeStamping`) in the signer if that changes.
- **Trust is per purpose on the devices.** macOS and iOS trust a root
  for S/MIME and code signing separately from TLS, so the trust
  bootstrap (see what the survey adds) has to install it for each.

"Create a CSR" in the console is really **request a certificate**: pick a
profile, fill in what its rules allow, then either submit a CSR the
subscriber made (preferred) or let Harpocrates generate the key. When
Harpocrates generates the key the CSR is an internal detail and never
shown. A standalone "produce a CSR" exists only for external CAs (2b).

## 3. Keys (decided D4)

**What the industry does.** The CA/Browser Forum's Baseline Requirements
(§6.1.1.3) do not forbid reusing a subscriber's key across renewals; they
require a CA to refuse a key it has been told is compromised, a known
weak key (Debian, ROCA, close primes), and, for `serverAuth`, any key
the CA generated itself. ACME clients differ: certbot makes a new key
unless `--reuse-key`; acme.sh keeps the domain key unless told
otherwise. Reuse is common where something pins the key (DANE `3 1 1`
records, HPKP-era pins); rekeying at renewal is the more cautious default.

**The model: one key, one request, many certificates.** A key is bound
to exactly one **enrollment**: the request that introduced it, with its
subject, SANs and profile. Its certificates are that enrollment's
lineage: the first issuance and every renewal.

```
key 1──1 enrollment (its CSR) 1──* certificate (issue, renew, renew, ...)
```

- Every key's SubjectPublicKeyInfo hash is unique across Harpocrates: CA
  keys, subject keys, generated and submitted. A CSR whose key belongs to
  another enrollment is refused, as is any CA's key as a subject key.
- **Renewal may keep the key.** A renewal over mTLS without a CSR, or an
  ACME `finalize` whose CSR carries the enrollment's key, the same names
  and the same profile, is recorded as a renewal of that enrollment, not
  a new request. Different names with the same key are refused: that
  would be a second request for one key.
- **Renewal may rekey**, which starts a new enrollment, linked to the one
  it replaces.
- **A profile caps a key's age** (`maxKeyAge`): past it, renewal must
  rekey. Defaults: 2 years for TLS, service and device keys; the
  certificate's own validity for CA keys, which are never reused by a
  successor.
- **Revoking for `keyCompromise` blocks the key for good** and revokes
  every certificate in its lineage (§6.1.1.3 item 4). Weak-key checks
  (Debian, ROCA, Fermat) run on every submitted key.
- **Generated keys for `serverAuth`** (`legacy-device`, generated
  `internal-tls`) break the BR's rule for public CAs, deliberately: the
  printer cannot make a CSR. The profile records that it generates, and
  the audit shows it.

Keys have a lifecycle the console shows on a certificate but never offers
as an action: `generated → bound → escrowed → destroyed`. An escrowed
key lives as long as its lineage, and is destroyed when the last of its
certificates is revoked or has been expired for a year. A key generated
for a request that never issued is destroyed after a day. The one key
action is exporting an escrowed key (ADR 0020: `pki-admin`, a reason, a
recent sign-in, audited).

## 4. Issuing

The issuer is chosen from a **CA tree**. The profile's pin is the default;
the override lists only CAs that could sign it: online, unsealed, inside
their issuing window, allowing the profile's EKUs, and whose name
constraints admit every name requested. The signer checks the last two
again whatever the service decided.

There is no approval queue: there is one operator. The exception is ACME,
whose name policy (per EAB credential) is the approval, decided when the
credential is created.

## 5. Revoking

By hand (a reason from RFC 5280's list, a confirmation naming the
subject), through the API, or by ACME `revokeCert`. Revocation deletes an
escrowed key and triggers a CRL within minutes. Revoking a CA does not
revoke what it issued (a relying party that checks the CA's status
rejects those anyway), but the console lists what is affected and offers
to reissue it from a successor.

No certificate hold: it is rarely honoured and never needed here.

## 6. Configuration and delivery

Two different things were called "distribution" (D5):

- **Issuer distribution** (per CA): the CRL distribution point and AIA
  URLs written into its certificates, the CRL's validity and schedule,
  and where lists are published (the `harpocrates-published` volume; the
  NAS pulls). Set in the CA wizard, rarely changed; a change applies to
  certificates issued afterwards only.
- **Certificate delivery** (per certificate): downloads (PEM, chain, DER,
  PKCS#12 modern or legacy) and **deploy targets**, which run on issue and
  on renewal: write to a host path and reload nginx, DSM through its API,
  the printer through its embedded web server. This is how the devices
  that cannot speak ACME or renew over mTLS stay current.

Each certificate also carries an owner, tags and notes, for the inventory.

## 7. Audit

Append-only, hash-chained: each event carries the hash of the one before,
and `harpocrates audit verify` checks the chain. Events: CA created,
imported, pending, activated, rolled over, revoked; key generated,
imported, exported, destroyed; request submitted, refused (and why);
certificate issued, renewed, revoked; CRL signed, published, failed; seal,
unseal; configuration changed; ACME account, EAB credential, order,
challenge, finalize, revoke; authentication failures. Each has the
principal (person, service certificate or ACME account), the surface and
a reason where one is required. The console filters by time, CA, subject,
principal and kind; the API exports.

## 8. SSH certificates (decided D6)

OpenSSH certificates are not X.509: no chains, no extensions beyond
OpenSSH's own, and revocation by **KRL** (key revocation list), not CRL.
The signer signs them (`cryptography`'s SSH certificate builder); the
rest of the model carries over.

| SSH CA                           | Signs             | Trusted by                                        |
| -------------------------------- | ----------------- | ------------------------------------------------- |
| `ncfritz.net SSH User CA 1 - G1` | User certificates | Hosts: `TrustedUserCAKeys`                        |
| `ncfritz.net SSH Host CA 1 - G1` | Host certificates | Clients: `@cert-authority *.internal.ncfritz.net` |

- **Flat, online, two keys.** OpenSSH has no hierarchy, so the root and
  its ceremonies do not apply; each CA is an online key in the signer,
  never shared between user and host. Rotation is a new generation
  trusted alongside the old until the old one's certificates expire.
- **Profiles:** `ssh-user` (principals from the operator's identity, 16
  hours, `permit-pty`, `permit-port-forwarding`; `source-address`
  optional), `ssh-host` (hostnames as principals, from the host's own
  public key, 90 days, renewed like `internal-tls`).
- **Keys:** CSR-equivalent only: the subscriber's public key is
  submitted, never generated here. The key model above applies,
  including uniqueness across X.509 and SSH.
- **Revocation:** a KRL per CA, signed and published next to the CRLs
  (`/krl/<slug>.krl`), for hosts to fetch on a schedule (`RevokedKeys`).
  Short user certificates make it rarely needed.
- **Surfaces:** the console issues and revokes, shows who holds a
  current user certificate, and gives the host and client configuration
  lines; a user certificate is requested with a public key and a
  sign-in (the API, from a small CLI later); hosts renew over mTLS like
  services.

## 9. Monitoring and notifications

Expiry is watched in two places, for two different jobs:

- **Alerting stays in the monitoring stack.** Harpocrates exports
  `certificate_expiry_days{issuer,profile,subject,serial}` for everything
  it knows, `harpocrates_crl_next_update_seconds{issuer}`,
  `harpocrates_issuing_window_days{issuer}`,
  `harpocrates_signer_sealed`, renewal and publication failures, and
  deploy-target results. Alertmanager rules in the monitoring stack page
  on them (thresholds per profile: 30 days for 1-year certificates, 14
  for 90-day ones, the root's CRL at 60). The monitoring stack is a
  separate concern (it outlives Harpocrates's own outages), so paging
  never depends on the CA being up.
- **Seeing it is in the console**, from the service's own records, not
  from Prometheus:
  - every list and detail shows expiry as time remaining, banded
    (expired, under the profile's threshold, renewing soon, fine) and
    whether it renews itself (ACME, mTLS renewal, a deploy target) or
    needs a person (the printer, signing certificates);
  - a **dashboard** page: counts by state; a timeline of expiries over
    the next 90 days, grouped by issuer; what needs a person this month;
    each CA's issuing window and each CRL's next update; seal state and
    the last publication; renewals, ACME orders and failures over the
    last week;
  - **deployed versus issued**: after a deploy target runs, and on a
    schedule, the service connects to the endpoint (TLS or SSH) and
    records which certificate it actually serves, so a renewal that was
    issued but never deployed shows on the dashboard. The same probe,
    pointed at a list of LAN endpoints, is the start of discovery.
- **Personal reminders**, optional: a certificate with an owner can
  notify them through the Olympus notification agent (RabbitMQ), for the
  things only a person can do (install on the printer, re-sign). This is
  best effort; the CA never waits on the platform.

## What the survey adds

From EJBCA, step-ca, Vault/OpenBao, Dogtag/FreeIPA, AD CS, AWS Private CA,
Google CAS, cfssl, Keyfactor Command, Venafi, pfSense/OPNsense and Caddy
(September 2026).

**Already in the plan, confirmed as common practice:** offline root and
online intermediates; profiles pinned to issuers; ACME with EAB and a
name policy; full CRLs regenerated before their next update; server-side
generation with escrow for devices that cannot make a CSR.

**Worth adding:**

| Feature                                                            | Seen in                             | Phase         |
| ------------------------------------------------------------------ | ----------------------------------- | ------------- |
| Issuing window and planned rollover                                | EJBCA, Vault, CAS pools, Caddy      | 2             |
| Key uniqueness (D4)                                                | none documents it; cheap to have    | 2             |
| Hash-chained audit with a verifier                                 | EJBCA                               | 2             |
| Inventory, expiry dashboard and alerts (section 9)                 | Keyfactor, Venafi, pfSense          | 3 and 7       |
| Deploy targets for non-ACME devices                                | Keyfactor orchestrators, certmonger | after 5       |
| Trust bootstrap: root download, `.mobileconfig`                    | Caddy `trust`, step                 | 7             |
| ACME Renewal Information (RFC 9773)                                | EJBCA, Let's Encrypt, cert-manager  | 6 (was Later) |
| LAN TLS discovery: scan for certificates Harpocrates did not issue | Keyfactor, Venafi                   | Later         |
| Compliance report: key sizes, lifetimes, algorithms                | pfSense, Keyfactor                  | Later         |
| SSH user and host certificates (section 8)                         | step-ca, Vault                      | 8 (new)       |

**Not worth it here:** OCSP, delta or partitioned CRLs, certificate hold,
multi-person approvals, LDAP publishing, EST/CMP/CMC, Windows
autoenrollment, `device-attest-01` (needs MDM-supervised devices),
post-quantum algorithms (keep the signer's algorithms swappable).

## Decisions

Decided (2026-09-25):

- **D1. The console** is `/harpocrates/ca` on
  `control.olympus.ncfritz.net`: Harpocrates is a property of Olympus
  Control. Code in `apps/harpocrates/console`.
- **D2. Roots and intermediates** are created and held by Harpocrates,
  offline: their keys exist in the signer only during a ceremony. XCA's
  root and intermediates are imported and XCA retired.
- **D3. Signing certificates** are code signing, S/MIME and document
  signing, from a new Signing CA.
- **D5. Distribution** is both: issuer distribution and certificate
  delivery.

- **D4. Keys**: one key per enrollment (its CSR), reusable across that
  enrollment's renewals up to the profile's `maxKeyAge`; unique across
  everything; blocked for good once compromised.
- **D6. SSH certificates** are in scope: a user CA and a host CA.
- **Signing certificates** are re-signed before they expire; no
  timestamping authority.
- **Monitoring**: Alertmanager for alerts, the console for seeing
  (per-certificate expiry, a dashboard, deployed-versus-issued).

Recorded in ADR 0020, amended and accepted on 2026-09-25, and in the
plan's phases.
