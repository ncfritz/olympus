# Issuing certificates with Harpocrates

The certificates behind [ADR 0018](../decisions/0018-authentication.md),
issued by Harpocrates, the internal CA
([ADR 0020](../decisions/0020-internal-certificate-authority.md)).

**Status, 2026-10-09.** XCA still issues production's certificates.
[ADR 0032](../decisions/0032-harpocrates-roots-and-migration.md)
replaces the cutover with new roots created in Harpocrates
(plan phase 5) and a migration from XCA later (phase 8). The procedures
below are Harpocrates's and hold once those roots exist; the hierarchy
shown is ADR 0020's and will be replaced by the roots ADR 0032 creates,
whose names are not chosen yet. This guide is rewritten when ADR 0032 is
accepted.

For development, `scripts/dev-ca.sh` writes a throwaway copy of the whole
hierarchy into `infra/dev-ca/certs`, in the same shape with `Dev` in every
name, and the tests use it. `scripts/dev-ca-import.sh` adopts it into the
development Harpocrates, so development issues and revokes the way
production does. Its `certs/README.txt` says what each file is for,
including which revocation lists a relying party needs: one from every
authority in the chain, which at this depth is three.

## Where to do it

- **The console**, at `https://control.olympus.ncfritz.net/harpocrates/ca`,
  once it exists (plan phase 7).
- **The API**, at `https://control.olympus.ncfritz.net/harpocrates/ca/api/v1`,
  with an access token from the API (roles `pki-operator` or
  `pki-admin`); `openapi/harpocrates.json` in the service describes it.
- **The CLI**, in the container, for everything until then and whenever
  the API cannot be reached. It acts with `pki-admin`'s rights and is
  audited like anything else:

  ```sh
  hcli() { infra/docker/stack.sh compose harpocrates exec -it harpocrates node dist/cli.js "$@"; }
  ```

  Files go in and out with
  `infra/docker/stack.sh compose harpocrates cp <from> <to>` (a container
  path is `harpocrates:/tmp/...`).

## The hierarchy

ADR 0020's, adopting XCA's; ADR 0032 replaces it with a
Primary root of the same three-tier layout plus a Server issuing CA, a
Dev root, and a bespoke root that signs directly.

```
ncfritz.net Root CA 1                          offline
├── ncfritz.net Intermediate CA 1              offline
│   ├── ncfritz.net Issuing CA 1 - G1          closed    network devices, until they expire
│   ├── ncfritz.net Issuing CA 2 - G1          closed    servers, until they expire
│   └── ncfritz.net TLS Issuing CA 1 - G1      online    internal hosts: *.internal.ncfritz.net
└── ncfritz.net Intermediate CA 2              offline
    ├── ncfritz.net Device Issuing CA 1        online    people's devices (the border)
    ├── ncfritz.net Service Issuing CA 1 - G1  online    services (the API's 3443)
    └── ncfritz.net Signing Issuing CA 1 - G1  online    code, mail, documents
```

Everything is ECDSA P-256, except where a device needs RSA (the
printer's `legacy-device` profile). Offline CAs' keys are on offline media
and in the password manager, and are only in the signer during a
ceremony.

**A request names a profile, not a CA.** The profile decides the key
type, validity, usages and names, and which CA signs; that is how a device
certificate never comes from the Service CA. The API still checks the
issuer's name for services (`AUTH_SERVICES_ISSUER`,
[ADR 0023](../decisions/0023-service-certificates-are-checked-by-issuer.md)).

| Profile         | Signed by  | Key                        | For                           |
| --------------- | ---------- | -------------------------- | ----------------------------- |
| `service`       | Service CA | CSR or generated           | an agent's client certificate |
| `api-server`    | Service CA | CSR or generated           | the API's `3443`              |
| `device`        | Device CA  | generated, exported        | a person's phone or laptop    |
| `internal-tls`  | TLS CA     | CSR or generated           | an internal host's HTTPS      |
| `legacy-device` | TLS CA     | generated, RSA, legacy P12 | the printer                   |
| `code-signing`  | Signing CA | CSR                        | signing code                  |
| `email`         | Signing CA | generated, exported        | S/MIME                        |
| `document`      | Signing CA | CSR or generated           | signing documents             |

## A service certificate

One per **deployment**, not per service: the asset agent runs on the
Docker host and on the NAS, and each has its own.

- `CN` is the service's app name exactly as it sends `X-Olympus-Client`
  and as `AUTH_SERVICE_ROLES` names it (`dionysus-asset-agent`); the API
  refuses a request whose header and certificate disagree. `OU` is the
  deployment: `prod`, `nas`.
- Make the key where it will live, and send the CSR:

  ```sh
  dir=/Users/ncfritz/Docker/secrets/tls/dionysus-asset-agent
  openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
    -keyout $dir/client.key -out $dir/client.csr -subj /CN=dionysus-asset-agent/OU=prod
  infra/docker/stack.sh compose harpocrates cp $dir/client.csr harpocrates:/tmp/
  infra/docker/stack.sh compose harpocrates exec -T harpocrates node dist/cli.js \
    issue --profile service --cn dionysus-asset-agent --ou prod --csr /tmp/client.csr \
    > $dir/client.crt
  ```

- `services-ca.crt` beside them is the chain: the Service CA,
  Intermediate CA 2 and the root
  (`http://pki.internal.ncfritz.net/ca/<slug>.crt`, DER).
- The key is read once at start, so a renewed certificate needs a
  restart. Add the service to the API's `AUTH_SERVICE_ROLES` before it
  calls, or every request is counted as an unknown service.

## Server certificates: the API's, and the agents' listeners

`server.crt` and `server.key` in a service's `${SECRETS_DIR}/tls/<service>`
(`TLS_CERT`, `TLS_KEY`): the `api-server` profile, from the Service CA,
with every name a client dials. For the API: `olympus-api` (the Docker
network), `api.olympus.internal.ncfritz.net` (the NAS and anything off
that network), `localhost` and `127.0.0.1`:

```sh
hcli issue --profile api-server --cn olympus-api --csr /tmp/server.csr \
  --dns olympus-api --dns api.olympus.internal.ncfritz.net --dns localhost --ip 127.0.0.1
```

An agent's listener (the calendar agent, the mail agent, the classifier)
gets the same kind of certificate: SAN and CN its service name, the name
the API or the mail agent dials. `stack.sh check` reads each one and says
what is wrong with it, and checks each call both ways round.

XCA issued these from **Issuing CA 2**, under Intermediate CA 1, so until
they are reissued a caller verifies a listener with a CA file holding Root
CA 1, Intermediate CA 1 and Issuing CA 2 (`API_CA_CERT`,
`<SERVICE>_CA_CERT`), and `TLS_SERVER_ISSUER` in `env/prod.env` names
Issuing CA 2. Under ADR 0032 a server certificate reissued
from Harpocrates comes from a Server issuing CA of its own under the
Primary root, so the caller's CA file becomes that chain, and
`TLS_SERVER_ISSUER` that CA's name, once every listener has moved (plan
phase 8).

**Never longer than 825 days.** Apple refuses a TLS server certificate
issued after 1 July 2019 whose validity is longer, and it refuses it
whatever anchor the certificate chains to -- a private CA the device has
been given is not an exemption. What a caller sees is the trust
evaluation failing, which `URLSession` reports as the _client_
cancelling: nothing at either end says the certificate was too
long-lived. The same page requires the name in a subject alternative name
rather than the common name, `id-kp-serverAuth` in an extended key usage,
SHA-2 throughout the chain, and RSA of at least 2048 bits or an elliptic
curve of at least 256 (<https://support.apple.com/en-us/103769>). The
profiles keep to it (`api-server` and `internal-tls` are a year or less),
and so does the dev CA.

## A device certificate

The key is generated in the signer and exported once as PKCS#12, which
is what an iPhone configuration profile and a browser import:

```sh
hcli issue --profile device --cn neil-iphone --ou iphone
hcli export-key --certificate <id> --format pkcs12 --reason "Neil's new iPhone" \
  --out /tmp/neil-iphone.p12
infra/docker/stack.sh compose harpocrates cp harpocrates:/tmp/neil-iphone.p12 .
```

`export-key` asks for the file's passphrase. It goes to the person over a
different channel than the file. Delete the container's copy afterwards.
Exporting is audited with its reason; over the API it needs `pki-admin`
and a sign-in within the last five minutes.

## Revocation

```sh
hcli revoke --certificate <id> --reason keyCompromise
```

That is all. Within a minute the CA signs a new list, publishes it to
`http://pki.internal.ncfritz.net/crl/<slug>.crl`, reads it back, and the
relying parties pick it up: the API within seconds (it polls its
`TLS_CRL_SERVICES` files), the NAS at its next pull (every 15 minutes).
`keyCompromise` revokes every certificate for that key and refuses the
key for good.

Lists are re-signed daily and valid for a week, so nobody exports them
any more; an alert fires if one is within two days of lapsing
(`harpocrates_crl_next_update_timestamp_seconds`). The offline CAs'
lists are the exception: 13 months, re-signed in a ceremony
(`hcli ceremony --issuer <slug> --key <file> --crl`), with an alert two
months ahead.

## Renewal

Nothing renews on its own yet (phase 5). `certificate_expiry_days` and
the renewal alert say when one is due, by its profile:

issue the same request again with a new CSR, or renew over the API
(`POST /v1/certificate/<id>/renew`, which keeps the key while it is
younger than the profile's maximum key age). Put the new certificate over
the old file and restart the service.

## Ceremonies

Creating an issuing CA, or signing an offline CA's list, needs that
offline CA's key in the signer for one ceremony. Copy the key from the
offline media into the container and run:

```sh
hcli ceremony --issuer intermediate-1-g1 --key /tmp/intermediate-1-g1.p8 --remove-key \
  --plan /tmp/plan.json --crl
```

A plan lists the issuing CAs to create. The key file is
removed once the ceremony opens, and the key leaves the signer when it
closes, whatever happened.
