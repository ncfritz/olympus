# Ceremony plans

What a ceremony creates, for `cli ceremony --plan <file>`
(docs/guides/harpocrates-cutover.md): each file is `{"issuing": [...]}`,
every item a `CreateIssuingIssuerRequest` as the API takes it, checked the
same way. They hold no secrets; the keys and passphrases never come near
the repository.

| File                          | Ceremony          | Creates                                                                 |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `cutover-intermediate-1.json` | Intermediate CA 1 | TLS Issuing CA 1 - G1: server only, `internal.ncfritz.net` and the LAN  |
| `cutover-intermediate-2.json` | Intermediate CA 2 | Signing Issuing CA 1 - G1: code, mail, documents; mail at `ncfritz.net` |

Name constraints follow ADR 0020 (Hierarchy). The TLS CA's longest
certificate is 398 days, what browsers accept; the internal-tls profile
issues 90. Check the constraints against the network and the mail domains
before the ceremony: they cannot be changed without a new CA.
