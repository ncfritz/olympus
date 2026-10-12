# 0035. Harpocrates: SSH certificates

- **Status:** Accepted
- **Date:** 2026-10-11; accepted 2026-10-11 (Neil)
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md) (SSH
  certificate authorities; Renewal and delivery),
  [ADR 0034](0034-harpocrates-profiles-versioned-presets.md) (profiles
  are for X.509 leaves)

## Context

ADR 0020 decided SSH certificates in outline: two flat, online CAs, the
`ssh-user` and `ssh-host` profiles, KRLs, and hosts renewing over mutual
TLS. Since then profiles became versioned presets (ADR 0034), and three
things it left open need deciding before phase 9 is built: how SSH
profiles fit beside X.509 ones, where a user certificate's principals
come from, and how a host renews with no one present.

OpenSSH certificates are not X.509. They have no chain, a 64-bit serial,
a free-text key ID, a list of principals, a validity window, critical
options (`force-command`, `source-address`) and extensions
(`permit-pty`, `permit-port-forwarding`, …). A host trusts user
certificates from a CA key (`TrustedUserCAKeys`); a client trusts host
certificates from one (`@cert-authority` in `known_hosts`). Revocation is
a KRL that `sshd` reads from a file (`RevokedKeys`).

## Decision

### Two CAs, online, Ed25519

- **ncfritz.net SSH User CA 1 - G1** (`ssh-user-1-g1`) signs user
  certificates; **ncfritz.net SSH Host CA 1 - G1** (`ssh-host-1-g1`)
  signs host certificates. Each is an Ed25519 key in the signer, never
  shared, and never an X.509 issuer's.
- They are not in the X.509 hierarchy: no root, no ceremony. An admin
  creates one after a recent sign-in; it is audited.
- Each has a **maximum validity**: 7 days for the User CA, 1 year for
  the Host CA, by default.
- **Rotation** is a new generation (`- G2`) created beside the old: new
  certificates come from the newest active generation, and both keys
  are trusted until the old one's certificates have expired; then the
  old one is retired.

### The signer signs SSH certificates

- The signer registers an SSH CA (its key, its kind, its maximum
  validity) and signs SSH certificates with it.
- **Invariants:** a CA signs only its own kind (a user CA never signs a
  host certificate); within its maximum validity; at least one
  principal; a subject key of a type OpenSSH accepts (Ed25519, ECDSA
  P-256/384/521, RSA of 3072 bits or more, signed `rsa-sha2-512`); never
  an issuer's key; and no critical options on a host certificate.

### SSH profiles are profiles of a kind

- A profile has a **kind**, `x509` or `ssh`, fixed when it is made. A
  copy keeps its kind. Versioning, history, diff, copy, deactivation,
  moving enrollments and preview are shared (ADR 0034).
- An SSH version holds its own settings: the **certificate type** (user
  or host), the CA (pinned, or the newest active one of that type),
  **validity** and renewal due in hours, maximum key age, the **key
  types** it takes, how **principals** are chosen (below), the
  **critical options** (`source-address`, `force-command`) and the
  **extensions** (`permit-pty`, `permit-port-forwarding`,
  `permit-agent-forwarding`, `permit-X11-forwarding`, `permit-user-rc`),
  each on or off.
- The seeded `ssh-user` (16 hours, `permit-pty` and
  `permit-port-forwarding`) and `ssh-host` (90 days, renewed at 60) are
  v1 of themselves.

### A user's principals are mapped by an admin

- An admin maps each Olympus identity (its Google email) to the
  principals (Unix user names) it may log in as: `neil@ncfritz.net` →
  `ncfritz`, `admin`. Mapping is audited.
- **Anyone signed in with a mapping** may request a user certificate for
  their own public key: it carries their mapped principals, or fewer if
  they ask for fewer, never more. No PKI role is needed for that.
- A pki-admin may issue a user certificate for any mapped identity, with
  that identity's principals.
- The key ID is `<identity>:<serial>`, so `sshd`'s log names who logged
  in with which certificate.

### A host renews by proving its host key

- A host certificate's principals are the host's names, given by the
  pki-admin who issues the first one (from the host's
  `ssh_host_ed25519_key.pub`).
- **Renewal needs no other credential.** The host fetches a challenge,
  signs it with its own host key (`ssh-keygen -Y sign`, namespace
  `harpocrates-ssh-renew`), and sends the signature with its current
  certificate to `9443`. A certificate that is current, unrevoked and
  for that key renews with the same principals under its version; an
  expired or revoked one does not, and needs an admin again.
- A small script, run from `cron` or `launchd`, does this and restarts
  `sshd` when the certificate changes. This replaces ADR 0020's renewal
  of SSH hosts over mutual TLS: a host would otherwise need an X.509
  client certificate only to renew its SSH one.

### Keys

- The subscriber's public key is always submitted; Harpocrates never
  generates an SSH key. Keys follow ADR 0020's model: a key already seen
  is reissued only for the same profile and principals, and never
  crosses between X.509 and SSH, or between a subject and a CA.

### Revocation

- Revoking an SSH certificate records it; the service rebuilds the CA's
  **KRL** (by serial) at once and daily, and publishes it beside the
  CRLs at `/krl/<slug>.krl`. Hosts fetch it on a schedule into the file
  `RevokedKeys` names.
- `sshd` does not check a KRL's signature, so the KRL is built by the
  service and not signed; hosts fetch it over HTTPS from the PKI host.
- User certificates are short enough that revoking one is rarely needed.

## Consequences

- The signer gains SSH CA registration, SSH signing and its invariants;
  the service gains SSH CAs, principal mappings, SSH issuance,
  revocation, KRLs and host renewal; profiles gain a kind.
- The console gains the SSH CAs with the lines to install
  (`TrustedUserCAKeys`, `@cert-authority`), certificates, a user's own
  certificate, the principal mappings, and the SSH sections of the
  profile editor.
- Hosts carry a renewal script and a KRL fetch; nothing else.
- A user without a mapping cannot get a user certificate, by design.

## Alternatives considered

- **SSH profiles in a table of their own:** simpler, but without
  versions a change would alter what renews.
- **Principals from the email's local part,** or typed per request: the
  first allows one principal per person and couples the email to Unix
  names; the second ties nothing to the person asking.
- **Hosts renewing over mutual TLS (ADR 0020):** a second credential on
  every host, itself to be renewed.
- **SSH CAs offline, in ceremonies:** every 16-hour certificate would
  need a ceremony.
