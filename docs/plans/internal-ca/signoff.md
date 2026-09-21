# Internal CA: functional sign-off

One test plan per flow of [ADR 0020](../../decisions/0020-internal-certificate-authority.md),
used to sign off each phase of the [plan](README.md). Automated tests
cover the logic; these checks prove the flows end to end on the real
pieces: the signer and its store, certificates, relying parties, ACME
clients, devices.

## Environments

| Id      | Where                                                                                | Used from |
| ------- | ------------------------------------------------------------------------------------ | --------- |
| **DEV** | the dev compose: `pki`, `pki-signer`, `pki-postgres`, the API, the dev CA            | phase 1   |
| **INT** | the Mac Mini's `pki` stack with the production issuers; the API, NAS and LAN clients | phase 4   |
| **EXT** | outside the LAN (a phone on mobile data), for device certificates issued by the CA   | phase 4   |

## Fixtures

| Fixture                     | What                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pki-admin`                 | a user with the `pki-admin` role                                              |
| `pki-operator`              | a user with the `pki-operator` role                                           |
| `user-reader`               | a user with no PKI role                                                       |
| `csr-service`               | a CSR for a real agent's CN, OU `test`, P-256                                 |
| `csr-out-of-bounds`         | a CSR for Internal TLS naming `example.com` beside an internal name           |
| `csr-tampered`              | `csr-service` with its signature broken                                       |
| `svc-issued`, `svc-revoked` | service certificates issued by the CA; valid / revoked                        |
| `dev-escrowed`              | a device certificate with a generated, escrowed key                           |
| `eab-nas`                   | an EAB credential whose policy allows `nas.internal.ncfritz.net` only         |
| `eab-none`                  | an ACME account registered without EAB (attempted)                            |
| `acme-clients`              | certbot, lego, acme.sh and Caddy in containers, each able to answer `http-01` |
| `crl-root`, `crl-forged`    | the root's list signed in XCA; a list for the root signed by another key      |
| `printer`                   | the HP Color LaserJet Pro MFP M479fdw and its embedded web server             |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

Evidence sources: `pki` and signer logs, the audit log
(`audit_events`), `/metrics` (`pki_signer_sealed`,
`pki_certificates_issued_total`, `pki_revocations_total`,
`certificate_expiry_days`), `openssl x509|crl|verify|s_client` output, the
API log (`auth` decisions, `CRL reloaded`), nginx access and error logs,
ACME client output, screenshots.

---

## C1 — Seal and unseal

The signer unseals itself at start; a deliberate seal holds until the
recovery passphrase is used.

| Id   | Env | Steps                                                        | Expected                                                                                | Evidence                        |
| ---- | --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------- |
| C1.1 | DEV | Start the signer with the unseal key mounted                 | `status` unsealed; issuance works; no operator action                                   | `status`; log                   |
| C1.2 | INT | Reboot the Mac Mini; touch nothing                           | after boot the signer is unsealed and a certificate can be issued                       | `pki_signer_sealed` 0; issuance |
| C1.3 | DEV | Start without the unseal key secret                          | starts sealed; issuance, renewal, ACME finalise and CRL signing `503`; reads still work | API responses; log              |
| C1.4 | DEV | C1.3 continued: sealed longer than 10 minutes                | the sealed alert fires                                                                  | alert                           |
| C1.5 | DEV | Unseal with the recovery passphrase (CLI, then the API)      | unsealed; issuance works                                                                | `status`; audit `unseal`        |
| C1.6 | DEV | Unseal with a wrong passphrase                               | refused; still sealed; nothing about the passphrase in the log                          | response; log                   |
| C1.7 | DEV | `seal`; restart the signer with the unseal key present       | still sealed after the restart; only the recovery passphrase unseals                    | `status`; audit `seal`          |
| C1.8 | DEV | Rotate the unseal key; restart                               | unseals with the new key; the old key no longer does                                    | `status`                        |
| C1.9 | DEV | Inspect the signer's SQLite file and the `pki` database dump | no private key in clear or PEM form in either                                           | `strings`/`grep` output         |

## C2 — The signer's boundary and invariants

| Id   | Env | Steps                                                                                 | Expected                                                                | Evidence                 |
| ---- | --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| C2.1 | DEV | List the signer container's listening sockets; try to reach it from another container | no TCP listener; only the Unix socket                                   | `ss -lx`/`ss -lt` output |
| C2.2 | DEV | Call the socket without the token, and with a wrong one                               | `401`                                                                   | response                 |
| C2.3 | DEV | Ask the signer directly to sign `csr-out-of-bounds` under Internal TLS                | refused: outside the name constraints                                   | response; signer log     |
| C2.4 | DEV | Ask for validity beyond the issuer's maximum, and past the issuer's own expiry        | refused                                                                 | response                 |
| C2.5 | DEV | Ask Olympus Devices to sign `serverAuth`; Internal TLS to sign `clientAuth`           | refused                                                                 | response                 |
| C2.6 | DEV | Ask any issuer to sign `CA:TRUE`                                                      | refused                                                                 | response                 |
| C2.7 | DEV | A certificate and a CRL from each issuer                                              | `openssl verify` against the chain passes; `openssl crl -verify` passes | `openssl` output         |

## C3 — Issuance by CSR

| Id   | Env | Steps                                                               | Expected                                                                                | Evidence                |
| ---- | --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------- |
| C3.1 | DEV | As `pki-operator`, submit `csr-service` with profile `service`      | certificate issued; subject as the CSR; EKU client; 1 year; CRL DP and AIA URLs present | `openssl x509 -text`    |
| C3.2 | DEV | Use the C3.1 certificate against the API's `3443`                   | accepted; principal `service/<agent>/test`                                              | API log                 |
| C3.3 | DEV | Submit `csr-tampered`                                               | `400`; nothing reaches the signer                                                       | response; signer log    |
| C3.4 | DEV | Submit a CSR whose subject breaks the profile (no OU for `service`) | `400` naming the rule                                                                   | response                |
| C3.5 | DEV | Issue 1,000 certificates in a loop                                  | serials unique, 20 bytes, positive; no collisions                                       | query; `openssl` sample |
| C3.6 | DEV | Download PEM, chain                                                 | the chain ends at the (dev) root                                                        | `openssl verify`        |

## C4 — Generated keys and escrow

| Id   | Env | Steps                                                                                   | Expected                                                                          | Evidence                      |
| ---- | --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| C4.1 | DEV | As `pki-admin`, issue `device` with a generated key; download PKCS#12 with a passphrase | a PKCS#12 holding key, certificate and chain; audit `issue` and `export`          | `openssl pkcs12 -info`; audit |
| C4.2 | DEV | Export `dev-escrowed` again a day later, with a reason, just after signing in           | the same key (public key matches the certificate); audit `export` with the reason | `openssl` compare; audit      |
| C4.3 | DEV | Export with a sign-in older than the limit (`auth_time`)                                | `403` asking for a recent sign-in; nothing exported                               | response; audit (refused)     |
| C4.4 | DEV | Export as `pki-operator`; as `user-reader`                                              | `403`                                                                             | response                      |
| C4.5 | DEV | Export without a reason                                                                 | `400`                                                                             | response                      |
| C4.6 | DEV | Revoke `dev-escrowed`; try to export                                                    | `404`/`410`; the key is gone from the signer's store                              | response; store query         |
| C4.7 | EXT | Install a CA-issued `device` PKCS#12 on an iPhone (profile) and a Mac (keychain)        | the border accepts both (authentication F9.1 passes for them)                     | screenshot; NAS log           |

## C5 — Revocation and revocation lists

| Id   | Env | Steps                                                                   | Expected                                                                            | Evidence                          |
| ---- | --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- |
| C5.1 | DEV | Revoke `svc-issued` with reason `keyCompromise`                         | a new list for its issuer within a minute, number one higher, containing the serial | `openssl crl -text`               |
| C5.2 | DEV | The list's validity                                                     | next update 7 days after this update                                                | `openssl crl -text`               |
| C5.3 | DEV | Leave it a day                                                          | a new list with the next number, though nothing was revoked                         | published directory; `crls` table |
| C5.4 | DEV | Fetch `http://…/crl/<issuer>.crl` and `/ca/<issuer>.crt`                | plain HTTP `200`, no redirect, no authentication; DER                               | `curl -v`                         |
| C5.5 | DEV | Make the distribution URL unreachable; revoke                           | publication recorded as failed; the alert fires; the list is retried                | log; alert                        |
| C5.6 | DEV | A published list within 2 days of its next update (short test lifetime) | the expiry alert fires                                                              | alert                             |
| C5.7 | DEV | Upload `crl-root`; upload `crl-forged`                                  | the first is verified and published; the second is refused                          | response; published directory     |
| C5.8 | DEV | Seal; wait past a daily publication; unseal                             | the missed list is signed as soon as the signer unseals                             | log; `crls` table                 |

## C6 — Relying parties

| Id   | Env      | Steps                                              | Expected                                                                                   | Evidence                       |
| ---- | -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| C6.1 | DEV, INT | Revoke a service certificate in use; touch no file | the API reloads the published list and refuses new connections from it within a minute     | API log `CRL reloaded`; tester |
| C6.2 | INT      | The NAS pull job after a device revocation         | the job fetches, verifies and swaps the file, reloads nginx; the revoked device is refused | job log; NAS nginx log         |
| C6.3 | INT      | Serve the NAS job a list with a bad signature      | the job keeps the previous file and fails loudly; nginx not reloaded                       | job log                        |
| C6.4 | INT      | Other services keep working through C6.1–C6.3      | no errors for unaffected certificates                                                      | API log; metrics               |

## C7 — Management API: auth and audit

| Id   | Env | Steps                                                                      | Expected                                                                               | Evidence               |
| ---- | --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| C7.1 | DEV | Call any management operation with no token; an expired one; a wrong `aud` | `401`                                                                                  | response               |
| C7.2 | DEV | `user-reader` lists certificates; issues one                               | `403` for both                                                                         | response               |
| C7.3 | DEV | `pki-operator` issues by CSR and revokes; tries to import an issuer        | the first two work; issuer import `403`                                                | response               |
| C7.4 | DEV | After C3–C5, read the audit log                                            | one event per issuance, revocation, export, seal and unseal, with principal and reason | audit query            |
| C7.5 | DEV | Stop the API (no JWKS); use the break-glass CLI to issue and revoke        | both work; audited as the CLI                                                          | CLI output; audit      |
| C7.6 | DEV | The OpenAPI document `/pki` and the SDK's `pki` client                     | every management operation present; the SDK builds                                     | document; build output |

## C8 — Cutover from XCA

| Id   | Env | Steps                                                   | Expected                                                                                  | Evidence                           |
| ---- | --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| C8.1 | INT | After the ceremony, the Internal TLS certificate        | signed by the root; path length 0; name constraints as the ADR; key never left the signer | `openssl x509 -text`; ceremony log |
| C8.2 | INT | Every certificate XCA issued under Services and Devices | present with its serial, dates and status; revoked ones revoked with their dates          | comparison against the XCA export  |
| C8.3 | INT | The first published lists                               | numbers above XCA's last for each issuer; the same revoked serials XCA's last lists held  | `openssl crl -text` side by side   |
| C8.4 | INT | Existing agents and devices, untouched                  | keep working (authentication F6.1, F7.1, F9.1)                                            | as those cases                     |
| C8.5 | INT | The exported XCA intermediate key files                 | deleted; XCA used afterwards only for the root                                            | ceremony log                       |
| C8.6 | INT | `pki`'s own `9443` certificate                          | issued by Internal TLS; a LAN client trusting the root connects without a warning         | `openssl s_client`                 |

## C9 — Renewal

| Id   | Env | Steps                                                                        | Expected                                                | Evidence         |
| ---- | --- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------- |
| C9.1 | DEV | An agent calls `POST /v1/renew` on `9443` with its certificate and a new CSR | a new certificate, same subject and profile, new serial | response; audit  |
| C9.2 | DEV | The agent keeps calling the API through the renewal                          | no restart; new connections present the new certificate | API log (serial) |
| C9.3 | DEV | Renew with `svc-revoked`; with an expired certificate; with no certificate   | `401`                                                   | response         |
| C9.4 | DEV | Renew a Services certificate with a Devices one (another issuer's subject)   | `403`                                                   | response         |
| C9.5 | DEV | Renew an escrowed key's certificate with no CSR                              | a new certificate for the same escrowed key             | response         |
| C9.6 | INT | A certificate that doesn't renew itself under 30 days                        | the expiry alert names it                               | alert            |

## C10 — ACME

| Id     | Env | Steps                                                                                 | Expected                                                                         | Evidence                 |
| ------ | --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| C10.1  | DEV | Register `eab-none`                                                                   | `externalAccountRequired`; no account                                            | client output            |
| C10.2  | DEV | Each of `acme-clients` registers with `eab-nas` and obtains a certificate (`http-01`) | certificate for `nas.internal…`, 90 days, Internal TLS                           | client output; `openssl` |
| C10.3  | DEV | Same with `tls-alpn-01` (the clients that support it)                                 | issued                                                                           | client output            |
| C10.4  | DEV | With `eab-nas`, order another internal name                                           | order refused before any challenge (`rejectedIdentifier`)                        | client output; log       |
| C10.5  | DEV | Order `example.com` with a policy that (wrongly) allowed it                           | refused at signing by the name constraints                                       | log; signer log          |
| C10.6  | DEV | A challenge whose token the host doesn't serve                                        | authorization invalid; no certificate                                            | client output            |
| C10.7  | DEV | Replay a request's nonce                                                              | `badNonce`                                                                       | client output / test     |
| C10.8  | DEV | Each client renews and revokes                                                        | renewed; revoked, and the serial in the next list                                | client output; CRL       |
| C10.9  | DEV | Account key rollover (lego)                                                           | the old key no longer works; the new one does                                    | client output            |
| C10.10 | INT | The Mac Mini nginx renews `olympus.internal` unattended                               | renewed before 30 days remain; nginx reloaded; browsers show the new certificate | certificate dates; log   |
| C10.11 | INT | The NAS DSM certificate through acme.sh's Synology deploy hook                        | DSM serves the new certificate                                                   | browser                  |

## C11 — The PKI area in the site

| Id    | Env | Steps                                                              | Expected                                                                          | Evidence    |
| ----- | --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------- |
| C11.1 | INT | As `pki-admin`, every action of the certificates guide from the UI | each works: issue (both modes), renew, revoke, download, export                   | screenshots |
| C11.2 | INT | Seal the signer                                                    | every page of the area shows sealed; actions that sign are disabled; unseal works | screenshot  |
| C11.3 | INT | Export an escrowed key with an old sign-in                         | the site sends the user through sign-in again, then exports                       | screenshot  |
| C11.4 | INT | As `user-reader`                                                   | the area is not offered; direct URLs show "not allowed"                           | screenshot  |
| C11.5 | INT | Create an EAB credential with a name policy; use it (C10.2)        | the account appears under the credential with its orders                          | screenshot  |

## C12 — The printer

| Id    | Env | Steps                                                                            | Expected                                                             | Evidence            |
| ----- | --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| C12.1 | INT | Issue `legacy-device` for `printer.internal…`; export PKCS#12 (legacy, no chain) | a file the embedded web server accepts                               | EWS screenshot      |
| C12.2 | INT | Browse to the printer's EWS over HTTPS from a laptop trusting the root           | no certificate warning; the certificate is the one issued            | browser             |
| C12.3 | INT | If C12.1 fails: the modern PKCS#12, then P-256 instead of RSA                    | the combination that works is recorded and the profile settled on it | EWS screenshot; ADR |

## Sign-off matrix

| Phase | Flows to pass                 |
| ----- | ----------------------------- |
| 1     | C1.1, C1.3–C1.9, C2 (DEV)     |
| 2     | C3, C4.1–C4.6, C7 (DEV)       |
| 3     | C5, C6.1 (DEV)                |
| 4     | C8, C1.2, C5.4, C6, C4.7, C12 |
| 5     | C9                            |
| 6     | C10                           |
| 7     | C11                           |
