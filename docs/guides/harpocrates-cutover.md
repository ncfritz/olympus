# The cutover from XCA to Harpocrates

Followed once, on the Mac Mini, and recorded (at the end). It brings up
the `harpocrates` stack, moves XCA's CAs, certificates and revocations into
it, creates the two new issuing CAs in ceremonies, switches the relying
parties to the published lists, and retires XCA
([ADR 0020](../decisions/0020-internal-certificate-authority.md); plan
phase 4; sign-off C8, C1.2, C5.4, C6, C4.7, C12, C13.5).

Rehearse it first in development: `scripts/dev-ca-import.sh` does steps 4
to 7 against the dev CA, and a ceremony there is the same command as
step 8 with the dev CA's keys (passphrase `olympus`).

Nothing below puts a key or a passphrase in the repository, a shell
history or a log: passphrases are asked for on the terminal, key files
are copied into the container and removed once used.

## What you need

- The images for this commit in the registry: `docker buildx bake
harpocrates --push` (and `services`, for the API change).
- XCA open, with its database and every CA key's password.
- The offline media and password manager entries for the root and both
  intermediates.
- Internal DNS: `pki.internal.ncfritz.net` → the Mac Mini (an A record
  beside `api.olympus.internal.ncfritz.net`).
- The ceremony plans checked (`apps/harpocrates/ceremonies`): the TLS CA's
  permitted names and LAN range, the Signing CA's mail domains. They
  cannot change without a new CA.
- A shorthand for the CLI in the container:

  ```sh
  hcli() { infra/docker/stack.sh compose harpocrates exec -it harpocrates node dist/cli.js "$@"; }
  ```

## 1. The stack

```sh
infra/docker/stack.sh bootstrap prod     # again: harpocrates's directories and secrets
infra/docker/stack.sh check harpocrates
infra/docker/stack.sh up harpocrates
hcli status                              # initialised: false, sealed: true
```

`bootstrap` is safe to repeat: it makes what is missing (the signer's
token, the Postgres password and the database URL) and leaves the rest.

## 2. Initialise the signer

```sh
infra/docker/stack.sh compose harpocrates exec -it harpocrates-signer \
  python -m harpocrates_signer initialise
```

It asks for a new recovery passphrase twice and prints the unseal key
once. Then:

1. The unseal key into `${SECRETS_DIR}/harpocrates_signer_unseal_key`
   (`chmod 600`), and into the password manager beside the recovery
   passphrase. Never in the same backup as `${DATA_DIR}/harpocrates/signer`.
2. `infra/docker/stack.sh restart harpocrates`, then `hcli status`:
   unsealed, with nobody typing anything. That is C1.2's point; reboot
   the Mac Mini later to prove it.

## 3. Export from XCA

Into a directory outside the repository (`~/cutover`), all PEM:

| What                                                 | XCA                                                             | File                |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| Each CA's certificate                                | Certificates → the CA → Export, PEM                             | `<slug>.crt`        |
| The online CAs' keys (Service, Device, Issuing 1, 2) | Private keys → Export, **PKCS#8 encrypted**, the key's password | `<slug>.p8`         |
| Everything each issuing CA issued                    | Select them all → Export → PEM (one file)                       | `<slug>-issued.pem` |
| Each CA's list, generated now                        | The CA → Generate CRL, then Revocation lists → Export, PEM      | `<slug>.crl`        |

The slugs: `root-1-g1`, `intermediate-1-g1`, `intermediate-2-g1`,
`service-issuing-1-g1`, `device-issuing-1-g1`, `issuing-1-g1`,
`issuing-2-g1`. The root's and the intermediates' keys are not exported:
they stay on the offline media. Generate the lists last, after any
revocation, so they hold everything XCA knows.

```sh
infra/docker/stack.sh compose harpocrates cp ~/cutover harpocrates:/tmp/cutover
```

## 4. The CAs

Offline, certificates only:

```sh
hcli import-issuer --id root-1-g1 --tier root --number 1 --generation 1 \
  --certificate /tmp/cutover/root-1-g1.crt
hcli import-issuer --id intermediate-1-g1 --tier intermediate --number 1 --generation 1 \
  --certificate /tmp/cutover/intermediate-1-g1.crt --chain /tmp/cutover/root-1-g1.crt
hcli import-issuer --id intermediate-2-g1 --tier intermediate --number 2 --generation 1 \
  --certificate /tmp/cutover/intermediate-2-g1.crt --chain /tmp/cutover/root-1-g1.crt
```

Online, with their keys (each asks for its XCA password):

```sh
hcli import-issuer --id service-issuing-1-g1 --tier issuing --purpose Service \
  --number 1 --generation 1 --max-validity-days 825 \
  --certificate /tmp/cutover/service-issuing-1-g1.crt \
  --chain /tmp/cutover/intermediate-2-g1.crt --chain /tmp/cutover/root-1-g1.crt \
  --eku 1.3.6.1.5.5.7.3.2 --eku 1.3.6.1.5.5.7.3.1 \
  --key /tmp/cutover/service-issuing-1-g1.p8
hcli import-issuer --id device-issuing-1-g1 --tier issuing --purpose Device \
  --number 1 --generation 1 --max-validity-days 825 \
  --certificate /tmp/cutover/device-issuing-1-g1.crt \
  --chain /tmp/cutover/intermediate-2-g1.crt --chain /tmp/cutover/root-1-g1.crt \
  --eku 1.3.6.1.5.5.7.3.2 \
  --key /tmp/cutover/device-issuing-1-g1.p8
```

Issuing CA 1 and 2 - G1, **closed**: they sign their lists and nothing
new, and retire with their last certificate:

```sh
for n in 1 2; do
  hcli import-issuer --id issuing-$n-g1 --tier issuing \
    --number $n --generation 1 --max-validity-days 825 --closed \
    --certificate /tmp/cutover/issuing-$n-g1.crt \
    --chain /tmp/cutover/intermediate-1-g1.crt --chain /tmp/cutover/root-1-g1.crt \
    --eku 1.3.6.1.5.5.7.3.1 --eku 1.3.6.1.5.5.7.3.2 \
    --key /tmp/cutover/issuing-$n-g1.p8
done
```

Names stay as XCA made them; ADR 0023's `AUTH_SERVICES_ISSUER` still
matches the Service CA.

## 5. What they issued

Each under the profile it will renew by. Split the Service CA's export
first: the API's `3443` certificate is `api-server`, the agents'
`service`.

```sh
hcli import-certificates --profile service      --file /tmp/cutover/service-issuing-1-g1-issued.pem
hcli import-certificates --profile api-server   --file /tmp/cutover/api.pem
hcli import-certificates --profile device       --file /tmp/cutover/device-issuing-1-g1-issued.pem
hcli import-certificates --profile legacy-device --file /tmp/cutover/issuing-1-g1-issued.pem
hcli import-certificates --profile internal-tls --file /tmp/cutover/issuing-2-g1-issued.pem
```

Each prints what it imported and what it passed over, and why. A
certificate already imported is passed over, so a file can be imported
again after a mistake. The count per CA should match XCA's (C8.2).

## 6. Their last lists

```sh
for slug in root-1-g1 intermediate-1-g1 intermediate-2-g1 service-issuing-1-g1 \
  device-issuing-1-g1 issuing-1-g1 issuing-2-g1; do
  hcli import-crl --issuer $slug --crl /tmp/cutover/$slug.crl
done
```

Each is checked against its CA's certificate. A certificate it names is
revoked with XCA's date and reason; a serial Harpocrates has no
certificate for is kept and listed from now on. Numbering continues from
XCA's.

## 7. The first lists signed here

```sh
hcli crls
```

The online CAs sign their next lists; all seven are published and read
back through `http://pki.internal.ncfritz.net` (the nginx stack must be up
with `nginx/pki.conf`: `infra/docker/stack.sh up nginx`, then
`nginx -s reload`). Compare with XCA's (C8.3):

```sh
curl -sf http://pki.internal.ncfritz.net/crl/service-issuing-1-g1.crl \
  | openssl crl -inform DER -noout -text | grep -E 'CRL Number|Serial Number' -A1
openssl crl -in ~/cutover/service-issuing-1-g1.crl -noout -text | grep -E 'CRL Number|Serial Number' -A1
```

The number is one higher; the serials are the same.

## 8. Ceremonies

The new TLS CA under Intermediate CA 1, the new Signing CA under
Intermediate CA 2, and every offline CA's list for 13 months. For each,
copy its key from the offline media into the container, then run the
ceremony; the key file is removed once the ceremony is open, the key is
destroyed in the signer when it closes, whatever happens:

```sh
infra/docker/stack.sh compose harpocrates cp apps/harpocrates/ceremonies/cutover-intermediate-1.json harpocrates:/tmp/
infra/docker/stack.sh compose harpocrates cp /Volumes/<media>/intermediate-1-g1.p8 harpocrates:/tmp/
hcli ceremony --issuer intermediate-1-g1 --key /tmp/intermediate-1-g1.p8 --remove-key \
  --plan /tmp/cutover-intermediate-1.json --crl
```

It asks for the key's passphrase. Then the same for `intermediate-2-g1`
with `cutover-intermediate-2.json`, and for `root-1-g1` with `--crl`
alone. Each prints the new CA's certificate;
`hcli crls` publishes the new lists.

Check the new CAs (C8.1):

```sh
curl -sf http://pki.internal.ncfritz.net/ca/tls-issuing-1-g1.crt | openssl x509 -inform DER -noout -text \
  | grep -E 'Issuer:|Subject:|pathlen|Permitted' -A2
```

## 9. Harpocrates's own certificate

For its `9443` listener (renewal and ACME, phase 5), from the TLS CA,
with a key made on the Mac Mini:

```sh
tls=/Users/ncfritz/Docker/secrets/tls/harpocrates     # ${SECRETS_DIR}/tls/harpocrates
mkdir -p $tls
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout $tls/server.key -out $tls/server.csr -subj /CN=harpocrates.internal.ncfritz.net
infra/docker/stack.sh compose harpocrates cp $tls/server.csr harpocrates:/tmp/
# -T, not hcli's -it: without a terminal only the certificate reaches stdout.
infra/docker/stack.sh compose harpocrates exec -T harpocrates node dist/cli.js \
  issue --profile internal-tls --cn harpocrates.internal.ncfritz.net \
  --dns harpocrates.internal.ncfritz.net --csr /tmp/server.csr > $tls/server.crt
```

## 10. The relying parties

- **The API**: in `infra/docker/env/prod/olympus-api.env`, replace
  `TLS_CRL_SERVICES` with the commented line below it (the published
  lists), commit, and `infra/docker/stack.sh up olympus`. Check the
  agents still call it (C8.4), then revoke a test service certificate
  and watch it refused within a minute (C6.1).
- **The NAS**: install the pull ([infra/nas](../../infra/nas/README.md))
  with the Device CA's chain pinned, and point nginx's `ssl_crl` at its
  output (C6.2, C6.3).
- **Monitoring**: load `apps/harpocrates/service/monitoring/harpocrates.rules.yml`
  and scrape `harpocrates:3200` as job `harpocrates`.

## 11. Retire XCA

1. Delete every exported key file: `~/cutover/*.p8`, and anything left
   in the container's `/tmp`
   (`infra/docker/stack.sh compose harpocrates exec harpocrates rm -rf /tmp/cutover`).
2. The root's and the intermediates' keys: only on the offline media and
   in the password manager (C8.5, C13.5).
3. Archive the XCA database, encrypted, beside the offline media; remove
   XCA from the Mac.
4. `hcli audit-verify`.

## Record

| Item                                  | Value |
| ------------------------------------- | ----- |
| Date, and who                         |       |
| Commit (`OLYMPUS_TAG`)                |       |
| XCA's last list number, per CA        |       |
| Harpocrates's first number, per CA    |       |
| Certificates imported, per CA         |       |
| Revocations imported, per CA          |       |
| TLS CA: SHA-256 fingerprint           |       |
| Signing CA: SHA-256 fingerprint       |       |
| `harpocrates` 9443 certificate serial |       |
| `audit-verify` output                 |       |
| XCA archive location                  |       |
