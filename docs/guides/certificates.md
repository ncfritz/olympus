# Issuing certificates in XCA

The certificates behind [ADR 0018](../decisions/0018-authentication.md).
They are issued by hand, from the XCA database that holds the internal
root; the internal CA ([ADR 0020](../decisions/0020-internal-certificate-authority.md))
replaces this later.

For development nothing here is needed: `scripts/dev-ca.sh` writes a
throwaway copy of the whole hierarchy into `infra/dev-ca/certs`, with the
same names, and the tests use it.

## The hierarchy

```
ncfritz.net Root CA 1
├── ncfritz.net Intermediate CA 1
│   ├── ncfritz.net Issuing CA 1 - G1     devices on the network: NAS, router
│   └── ncfritz.net Issuing CA 2 - G1     server certificates, api.olympus…
└── ncfritz.net Intermediate CA 2
    ├── ncfritz.net Device Issuing CA 1   people's devices (the border)
    └── ncfritz.net Service Issuing CA 1  services (the API's 3443)
```

Everything is ECDSA P-256. ADR 0018 calls the last two Olympus Services
and Olympus Devices; those are their roles, and the names above are what
XCA holds.

A device certificate must not act as a service. The chain does not enforce
that on its own — the two issuing CAs are siblings, so a trust store that
terminates at the root accepts either — so the API checks the issuer's
common name against `AUTH_SERVICES_ISSUER`
([ADR 0023](../decisions/0023-service-certificates-are-checked-by-issuer.md)).
Getting the signing CA right therefore matters as much as getting the
subject right.

## One-off: the issuing CAs

Both already exist under `Intermediate CA 2`. If one has to be recreated:
signed by `Intermediate CA 2`, template `[default] CA`, key EC /
`prime256v1`, `O = ncfritz.net`, `OU = Infrastructure`, validity 5 years,
extensions `Certificate Authority` with path length `0` (it signs no
further CAs) and key usage `Certificate Sign`, `CRL Sign`.

Export each with **everything above it** in one file — the chain has to
terminate at a self-signed certificate in the verifier's store, so the
file is the issuing CA, `Intermediate CA 2` and `Root CA 1`, in that
order: `services-ca.crt`, `devices-ca.crt`.

Every CA above a leaf must allow one below it: a path length of 0 two
levels up fails with "path length constraint exceeded", and the CA has to
be reissued.

## The API's server certificate

Signed by **Service Issuing CA 1**, template `[default] TLS_server`:

- `CN = olympus-api`, `O = ncfritz.net`.
- Subject alternative names, all of them — a client verifies the name it
  dialled: `DNS:olympus-api` (the Docker network),
  `DNS:api.olympus.internal.ncfritz.net` (the NAS and anything off that
  network), `DNS:localhost`, `IP:127.0.0.1`.
- Extended key usage `TLS Web Server Authentication`. Validity 1 year.
- Export the certificate and its key as PEM: `TLS_CERT`, `TLS_KEY`.

## A service certificate

One per **deployment**, not per service: the asset agent runs on the
Docker host and on the NAS, and each has its own.

- Signed by **Service Issuing CA 1** (ADR 0018's Olympus Services),
  template `[default] TLS_client`. The API rejects a certificate signed by
  anything else, whatever its subject says.
- `CN` is the service's app name exactly as it sends `X-Olympus-Client`
  and as `AUTH_SERVICE_ROLES` names it: `dionysus-asset-agent`. The API
  refuses a request whose header and certificate disagree.
- `OU` is the deployment: `prod`, `nas`. The API records it on the
  principal; it is how two deployments of one service are told apart.
- Extended key usage `TLS Web Client Authentication`. Validity 1 year.
- Export the certificate and key as PEM into that deployment's own TLS
  directory — `${SECRETS_DIR}/tls/<service>` on the Docker host, mounted at
  `/run/secrets/tls` — as **`client.crt`**, **`client.key`** and
  **`services-ca.crt`**. The same three names in every deployment: the
  directory already says which agent it is, which is what lets one setting
  serve them all. The key is read once at start, so a renewed certificate
  needs a restart.
- Add the service to the API's `AUTH_SERVICE_ROLES` before it calls, or
  every request is counted as an unknown service.

## A device certificate

- Signed by **Olympus Devices**, template `[default] TLS_client`.
- `CN = <person>-<device>` (`neil-iphone`), `OU` the device kind.
  Validity 1 year.
- Export as PKCS#12 with a passphrase: that is what an iPhone
  configuration profile and a browser both import. The passphrase goes to
  the person over a different channel than the file.

## Revocation

A CRL comes from the CA that signed the certificate below it, so a
verifier needs one per signing authority in the chain — three, for this
hierarchy ([ADR 0023](../decisions/0023-service-certificates-are-checked-by-issuer.md)):
the issuing CA's, `Intermediate CA 2`'s and `Root CA 1`'s. Revoke in XCA,
then export all three:

- The API (`TLS_CRL_SERVICES`) takes them as separate files, because Node
  reads only the first list in a file. It reloads them within seconds of
  the files changing; no restart.
- nginx (`ssl_crl`) takes its three concatenated into one file, and
  reloads with `nginx -s reload`.

`Intermediate CA 2` and `Root CA 1` sign both chains, so their lists are
shared: four files across the system, three per verifier.

Export every list on each revocation, and before `nextUpdate` regardless.
An expired list is treated as no list, and Node checks the whole chain, so
one stale file refuses every service — it fails closed.

## Renewal

Nothing renews on its own yet. A year ahead of expiry, issue the
replacement from the same XCA entry (**Renew**, keeping the key or with a
new one), export it over the old file and restart the service. The
`certificate_expiry_days` metric of phase 7 is what tells you it is due.
