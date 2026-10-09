# The NAS

Scripts that run on the NAS (nfs01) itself, outside Docker. Its Docker
stack is `infra/docker/compose/nas.yml`.

## Revocation lists for nginx

`crl-pull.sh` keeps the NAS nginx's `ssl_crl` file current from
Harpocrates (ADR 0020, Distribution): it fetches each CA's list from
`http://pki.internal.ncfritz.net/crl/<slug>.crl`, verifies it against
that CA's certificate, pinned on the NAS (never fetched), checks it has
not lapsed, concatenates them, swaps the file and reloads nginx. On any
failure the previous file stays, nginx is not reloaded, and the script
exits non-zero. It pulls, so the CA needs no credentials for the NAS.

Setup, once, as root on the NAS:

```sh
mkdir -p /usr/local/etc/harpocrates/trust
cp crl-pull.sh /usr/local/bin/harpocrates-crl-pull
# The chain the NAS's clients (people's devices) come from, PEM, by slug:
#   device-issuing-1-g1.crt  intermediate-2-g1.crt  root-1-g1.crt
# from http://pki.internal.ncfritz.net/ca/<slug>.crt, checked by hand
# (openssl x509 -inform DER -in <file> -noout -fingerprint -sha256)
# against the console before they are trusted.
```

and point nginx at the output:

```nginx
ssl_client_certificate /usr/local/etc/harpocrates/trust/device-chain.pem;
ssl_crl                /usr/local/etc/harpocrates/crl.pem;
```

Then, in DSM's Task Scheduler, a user-defined script as root every 15
minutes, with "send run details by email" only when it ends abnormally:

```sh
CRL_TRUST_DIR=/usr/local/etc/harpocrates/trust \
CRL_OUT=/usr/local/etc/harpocrates/crl.pem \
/usr/local/bin/harpocrates-crl-pull
```

| Variable        | Default                                           | Meaning                                       |
| --------------- | ------------------------------------------------- | --------------------------------------------- |
| `CRL_BASE_URL`  | `http://pki.internal.ncfritz.net`                 | The distribution host                         |
| `CRL_ISSUERS`   | `device-issuing-1-g1 intermediate-2-g1 root-1-g1` | The chain's CAs, by slug                      |
| `CRL_TRUST_DIR` | —                                                 | `<slug>.crt` (PEM) for each of them           |
| `CRL_OUT`       | —                                                 | The file `ssl_crl` names                      |
| `CRL_RELOAD`    | `nginx -s reload`                                 | How to reload nginx after the file is swapped |

The lists are valid for a week and re-signed daily, so a pull every 15
minutes leaves days of slack if the NAS or the CA is down, and a device
revoked in the console is refused within one interval. The service's
e2e tests run the script against published lists
(`apps/harpocrates/service/test/e2e/crls.spec.ts`).
