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
ncfritz.net Root CA
├── Olympus Services   signs services; only the API's 3443 trusts it
│   ├── olympus-api                 (server certificate)
│   └── <agent>-agent               (one per deployment)
└── Olympus Devices    signs people's devices; only the NAS nginx trusts it
    └── <person>-<device>
```

Everything is ECDSA P-256. A device certificate cannot act as a service
and a service certificate does not pass the border, because the two
verifiers trust different intermediates.

## One-off: the intermediates

1. **New Certificate**, signed by `ncfritz.net Root CA`, template
   `[default] CA`, key EC / `prime256v1`.
2. Subject: `CN = Olympus Services`, `O = ncfritz.net`,
   `OU = Infrastructure`. Validity 5 years.
3. Extensions: `Certificate Authority`, path length `0` (it signs no
   further CAs), key usage `Certificate Sign`, `CRL Sign`.
4. Repeat for `CN = Olympus Devices`.
5. Export each as PEM, and the root with it: what a verifier trusts is
   the intermediate **and** the root in one file
   (`services-ca.crt`, `devices-ca.crt`).

The root itself must allow a CA below it (path length at least 1). If it
was issued with path length 0, the chain fails with "path length
constraint exceeded" and the root has to be reissued.

## The API's server certificate

Signed by **Olympus Services**, template `[default] TLS_server`:

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

- Signed by **Olympus Services**, template `[default] TLS_client`.
- `CN` is the service's app name exactly as it sends `X-Olympus-Client`
  and as `AUTH_SERVICE_ROLES` names it: `dionysus-asset-agent`. The API
  refuses a request whose header and certificate disagree.
- `OU` is the deployment: `prod`, `nas`. The API records it on the
  principal; it is how two deployments of one service are told apart.
- Extended key usage `TLS Web Client Authentication`. Validity 1 year.
- Export the certificate and key as PEM next to the service
  (`API_CLIENT_CERT`, `API_CLIENT_KEY`), and the Services chain as
  `API_CA_CERT`. The key is read once at start: a renewed certificate
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

Revoke in XCA, then export the list of **both** the intermediate and the
root — a verifier checks every authority in the chain:

- The API (`TLS_CRL_SERVICES`) takes them as separate files, because Node
  reads only the first list in a file. It reloads them within seconds of
  the files changing; no restart.
- nginx (`ssl_crl`) takes the two lists concatenated into one file, and
  reloads with `nginx -s reload`.

Export both lists on every revocation, and at least monthly regardless:
a list that has expired is treated as no list at all.

## Renewal

Nothing renews on its own yet. A year ahead of expiry, issue the
replacement from the same XCA entry (**Renew**, keeping the key or with a
new one), export it over the old file and restart the service. The
`certificate_expiry_days` metric of phase 7 is what tells you it is due.
