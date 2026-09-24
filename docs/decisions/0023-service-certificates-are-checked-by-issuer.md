# 0023. A service certificate is checked by its issuer, not only its chain

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

[ADR 0018](0018-authentication.md) describes two intermediates under the
internal root — Olympus Services for agents, Olympus Devices for people's
devices — and concludes:

> A device certificate can't act as an agent, an agent certificate doesn't
> pass the border, and each is revoked separately.

That conclusion depends on the two verifiers trusting disjoint sets of
certificates. The real hierarchy is deeper than the record assumed, and
they are not disjoint:

```
ncfritz.net Root CA 1
├── ncfritz.net Intermediate CA 1
│   ├── ncfritz.net Issuing CA 1 - G1      devices on the network: NAS, router
│   └── ncfritz.net Issuing CA 2 - G1      server certificates, api.olympus…
└── ncfritz.net Intermediate CA 2
    ├── ncfritz.net Device Issuing CA 1    people's devices (the border)
    └── ncfritz.net Service Issuing CA 1   services (the API's 3443)
```

The two issuing CAs that ADR 0018 calls Olympus Services and Olympus
Devices are siblings under **one** parent. A verifier's trust store has to
contain a self-signed certificate for the chain to terminate at — OpenSSL
requires it unless `X509_V_FLAG_PARTIAL_CHAIN` is set, which Node does not
expose — so `services-ca.crt` holds the issuing CA, Intermediate CA 2 and
Root CA 1. A leaf issued by **Device** Issuing CA 1 therefore chains
through Intermediate CA 2 to a trusted root and verifies on the services
listener. The separation the record claims is not enforced by the chain.

What has been standing in for it is `ServiceIdentityService`: the common
name must appear in `AUTH_SERVICE_ROLES`, so `CN=neil-iphone` is refused.
That is a useful check and not the one claimed — it turns a structural
guarantee into a naming coincidence, and it holds only while one person
issues every certificate by hand. [ADR 0020](0020-internal-certificate-authority.md)
introduces ACME issuance under the same parents, at which point "no device
certificate is ever named after a service" stops being something anyone
can promise.

## Decision

### The API checks who signed the certificate

`ServiceIdentityService` reads the peer certificate's issuer and requires
its common name to equal `AUTH_SERVICES_ISSUER`. A certificate that the
handshake accepted but that a different CA signed is refused, with the
issuer named in the reason so the log says what happened.

This is a check the application can make with certainty, unlike the trust
store, whose behaviour depends on an OpenSSL flag Node does not expose.
The handshake still does the cryptography; this decides whether the
authority that signed is the authority we meant.

`AUTH_SERVICES_ISSUER` is unset by default and the check is then skipped,
so an environment without certificates is unchanged. Where the services
listener runs, it is set.

### Revocation lists follow the chain, and there are three

A CRL is issued by the CA that signed the certificate below it, so a
verifier needs one per signing authority in the chain it checks — not
"the intermediate's and the root's" as ADR 0018 has it, which was written
for a two-level hierarchy. Node sets `CRL_CHECK_ALL` whenever a list is
given, so the whole chain is checked and a missing or expired list fails
the handshake closed.

| Verifier            | Chain                                                       | Lists it needs                        |
| ------------------- | ----------------------------------------------------------- | ------------------------------------- |
| The API's `3443`    | leaf ← Service Issuing CA 1 ← Intermediate CA 2 ← Root CA 1 | those three CAs', as separate files   |
| nginx at the border | leaf ← Device Issuing CA 1 ← Intermediate CA 2 ← Root CA 1  | those three CAs', concatenated in one |

Four distinct lists in total; two of them are shared. An expired list is
treated as no list, so all four are re-exported before `nextUpdate`
whether or not anything was revoked.

## Consequences

- The invariant ADR 0018 states is now enforced rather than asserted, and
  by something that does not depend on OpenSSL chain-building subtleties.
- A renamed or reissued service-issuing CA is a configuration change on
  the API. That is the cost of naming the authority, and it is cheap
  beside discovering that the authority was never checked.
- Every CA level costs a revocation list in every verifier below it. Four
  levels is three lists per chain, forever, and the exports have to be
  scripted rather than remembered. Whether the hierarchy stays this deep
  is [ADR 0020](0020-internal-certificate-authority.md)'s to settle; this
  record only says what it costs.
- Trusting the issuing CA alone — one certificate in the store, no shared
  parent — would make the chain enforce the separation by itself. It needs
  `X509_V_FLAG_PARTIAL_CHAIN`, which Node does not expose today; if that
  changes, the issuer check stays anyway as defence in depth.
- Where this record and ADR 0018 disagree on what the chain guarantees and
  on how many revocation lists there are, this one is right; ADR 0018 is
  otherwise unchanged, as records are.

## Open

- Whether the devices side gets the same treatment at the border. nginx
  can be told `ssl_client_certificate` for one CA, and whether that
  terminates a chain there has the same `PARTIAL_CHAIN` question behind
  it, with a different verifier's answer.
