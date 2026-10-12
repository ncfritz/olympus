# 0036. Harpocrates: OCSP

- **Status:** Proposed
- **Date:** 2026-10-11
- **Amends:** [ADR 0020](0020-internal-certificate-authority.md)
  (Serials, revocation and publication: "OCSP is not provided"),
  [ADR 0034](0034-harpocrates-profiles-versioned-presets.md) (OCSP,
  planned)

## Context

ADR 0020 left OCSP out: every relying party in the home lab is ours,
and each checks a revocation list. ADR 0034 planned it as a later
phase, with the AIA OCSP URL and must-staple (the TLS feature extension)
as profile settings once a responder exists. Phase 11 builds it.

Three things make OCSP worth having now:

- Clients that are not ours (browsers, macOS and iOS, Java) prefer OCSP,
  or only use it, and a list fetched once a day is coarser than a
  status asked about one certificate.
- A server that staples (nginx's `ssl_stapling`) hands clients a fresh
  signed status with the handshake, so no client has to reach the PKI
  host; must-staple makes a client refuse the certificate without it.
- Revocations reach OCSP clients in minutes rather than at the next
  list refresh.

The constraints are ADR 0020's: CA keys stay where they are (offline CAs
only in the signer during a ceremony), the signer is the only thing that
signs and enforces invariants, a sealed signer must not take revocation
checking down with it, and the distribution host is plain HTTP so that
checking a certificate never depends on one the CA issued.

## Decision

### Delegated responders, one per CA

- **Every CA has an OCSP responder certificate**: issued by that CA,
  for a P-256 key the signer generates and keeps online (a new key
  purpose, `ocsp`, alongside `issuer` and `subject`). It is a leaf with
  extended key usage `id-kp-OCSPSigning` only, key usage
  `digitalSignature`, and `id-pkix-ocsp-nocheck`, with no CRL
  distribution point or AIA of its own (RFC 6960 §4.2.2.2).
- **An online CA's** responder is issued and renewed by the service,
  with no one present: valid 30 days, renewed with a new key when 10
  remain.
- **An offline CA's** responder is issued in a ceremony of that CA,
  valid 13 months like its list, and renewed in the same yearly
  ceremony. An alert fires two months before it lapses, as for the list.
- Because responders carry `ocsp-nocheck`, revoking one does not stop
  it: an online CA's is short-lived for that reason, and an offline CA's
  is replaced in a ceremony if its key is ever in doubt (the old key is
  destroyed in the signer).
- A root has no issuer and so no OCSP for its own certificate; the
  responders cover every certificate a CA issued, leaves and CAs alike.

### Pre-signed responses, refreshed like the lists

- **The service keeps a signed response for every certificate** a CA
  issued that has not expired: good, or revoked with its time and
  reason. Each is valid 4 days (`OCSP_VALIDITY_HOURS`, the response's
  `nextUpdate`) and re-signed daily (`OCSP_REFRESH_HOURS`), in batches
  by the scheduler that writes the lists.
- **A revocation re-signs that certificate's response at once**, as it
  writes the CA's list at once.
- **A sealed signer stops refreshing, not answering**: stored responses
  are served until they lapse, so a seal of up to three days is
  invisible to OCSP clients. A response that has lapsed is not served
  (`tryLater`), and an alert fires a day before any would.
- **No request nonces.** A pre-signed response cannot echo one, browsers
  and OpenSSL's clients do not send them, and the RFC 5019 profile
  serves without them. A request with a nonce is answered without it.
- **The signer signs responses** only with an `ocsp` key, only for
  certificates of the CA whose responder that key is, only with a
  `thisUpdate` not in the future and a `nextUpdate` no later than the
  responder certificate's `notAfter` and at most a week ahead.
- A serial a CA never issued, or an issuer the responder does not know,
  is answered `unauthorized` (unsigned); it is never `good`.

### Served from the PKI host over HTTP

- `http://pki.internal.ncfritz.net/ocsp`, GET (`/ocsp/<base64 request>`)
  and POST (`application/ocsp-request`), as RFC 6960 and the RFC 5019
  lightweight profile describe: one certificate per request, SHA-1 or
  SHA-256 `CertID`s, and `Cache-Control` and `ETag` so the response is
  cached until shortly before its `nextUpdate`.
- nginx's distribution host proxies `/ocsp` to the service; the route
  is outside `/v1` and its document, open to anyone, and served on the
  management listener only through that proxy. Plain HTTP, as for the
  lists: responses are signed, and checking a certificate must not
  depend on one the CA issued.

### AIA OCSP and must-staple, per profile version

- **Each CA has an OCSP URL**, `PKI_DISTRIBUTION_URL/ocsp` unless set
  otherwise, shown and edited on its page as its issuer alternative
  names are.
- **A version setting includes it** in its certificates' AIA (off by
  default, and for every seeded version). It is offered only once the
  issuing CA has a responder in service.
- **Must-staple** (the TLS feature extension with `status_request`,
  RFC 7633) is a version setting too, off by default and for every
  seeded version. A version that sets it must include the OCSP URL; the
  signer refuses the TLS feature in a certificate without an OCSP URL
  in its AIA, and any TLS feature other than `status_request`.
- CA certificates do not carry the OCSP URL in this phase: a CA's status
  is checked by its parent's list. The responders still answer for them.

### Watched

- Metrics: requests by result (good, revoked, unauthorized, malformed,
  tryLater), each CA's oldest response's time to `nextUpdate`, each
  responder certificate's time to `notAfter`, and refresh failures.
- Alerts: a response a day from lapsing, refreshes failing for an hour,
  an online CA's responder within 5 days of lapsing, an offline CA's
  within two months.
- The endpoint checks (phase 6) ask for a stapled status and record
  whether one came, and alert when a must-staple certificate is served
  without one.

## Consequences

- The signer gains the `ocsp` key purpose, responder certificates (from
  an online CA's key or in a ceremony) and response signing, each with
  its invariants; the TLS feature joins the extensions it builds.
- The service gains responders, stored responses and their refresh, the
  `/ocsp` route, a CA's OCSP URL, two version settings, metrics and
  alerts; nginx's `pki.conf` proxies `/ocsp`.
- The console shows each CA's responder and its responses' freshness,
  offers an offline CA's responder in a ceremony, and offers the two
  settings in the profile editor.
- Turning must-staple on for a profile is a decision per profile, once
  every server using it staples: until then it is off everywhere.
- Revocation is visible to OCSP clients within minutes, and to list
  clients as before. Responses lapse after a seal of more than three
  days; lists after seven.

## Alternatives considered

- **Each CA signing its own responses**: no extra certificates, but an
  issuing CA's key signs constantly and an offline CA could not answer
  at all.
- **Only leaves from online CAs**: simplest, but leaves CA certificates
  and every offline CA's issues to lists alone.
- **Signing each request** (for nonces): every request reaches the
  signer, and a sealed signer stops OCSP at once.
- **The renewal listener over HTTPS**: unusual for OCSP, and circular
  for checking the listener's own certificate.
