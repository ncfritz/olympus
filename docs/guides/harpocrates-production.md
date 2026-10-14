# Harpocrates in production

Bringing the internal CA up on the Mac Mini, empty, and making its first
CAs ([ADR 0032](../decisions/0032-harpocrates-roots-and-migration.md);
plan phases 4 and 5; sign-off C1.2). XCA keeps running beside it: what it
issued is replaced later, in the migration (phase 8,
[ADR 0037](../decisions/0037-harpocrates-xca-imported-for-the-record.md)).
This replaces [the cutover guide](harpocrates-cutover.md).

Nothing here puts a key, a passphrase or the unseal key in the
repository, a shell history or a log: the console asks for passphrases
and shows the unseal key once.

## Before: decide

These cannot change without a new CA, so settle them before step 6:

- **Each CA's name and shape.** The console proposes names from
  `PKI_REALM` (`ncfritz.net Root CA 1 - G1` and so on) and three shapes
  (three tiers, two tiers, a root that signs directly). ADR 0032's
  layout is a Primary root (three tiers, with a Server issuing CA), a Dev
  root, and a root that signs directly.
- **The TLS CA's permitted names and LAN range** (`internal.ncfritz.net`,
  `192.168.15.0/24`) and **the Signing CA's mail domains**
  (`ncfritz.net`).
- **Where the offline keys live**: the offline media (two copies) and the
  password manager entry for each passphrase.

## 1. The commit, the images, the tag

1. Merge `feature/internal-ca` into `main` and pull it on the Mac Mini.
2. `pnpm install`, then the checks (`pnpm turbo run build lint typecheck
test check:conventions`) and, with a Postgres running, the service's
   end-to-end suite (`pnpm --filter @ncfritz/harpocrates-service
test:e2e`, with `HARPOCRATES_E2E_DATABASE_URL` set).
3. Build and push the three images at that commit:

   ```sh
   infra/docker/stack.sh build --push --env prod harpocrates   # the service and the signer
   infra/docker/stack.sh build --push --env prod olympus       # the console, and the rest of Olympus
   ```

4. Set `OLYMPUS_TAG` in `infra/docker/env/prod.env` to that commit, and
   commit it: it is what a rollback sets back.

## 2. DNS

An A record `pki.internal.ncfritz.net` → the Mac Mini, beside
`api.olympus.internal.ncfritz.net`. The lists, the CA certificates and
the OCSP responder are served there over HTTP; renewal, ACME and SSH
hosts' renewal on its `9443` over TLS.

## 3. The stack

```sh
infra/docker/stack.sh bootstrap prod        # again: harpocrates's directories and secrets
infra/docker/stack.sh check harpocrates
infra/docker/stack.sh up harpocrates
infra/docker/stack.sh up olympus nginx      # the console, and pki.internal / control routes
```

`bootstrap` is safe to repeat: it makes the signer's token, the Postgres
password and the database URL if missing, and leaves
`harpocrates_signer_unseal_key` empty, so the signer starts sealed.
`LAN_BIND` (`0.0.0.0` in `prod.env`) publishes `9443` on the LAN.

Check: `https://control.olympus.ncfritz.net/harpocrates/ca` signs in
through Olympus and opens the first-run page.

## 4. Initialise the signer

On the console's first-run page (`/harpocrates/ca/setup`):

1. A new recovery passphrase, twice. Into the password manager.
2. The unseal key, shown once. Into
   `${HARPOCRATES_SECRETS_DIR}/harpocrates_signer_unseal_key`
   (`chmod 600`) and into the password manager beside the passphrase.
   Never in the same backup as `${DATA_DIR}/olympus/apps/harpocrates/signer`.
3. `infra/docker/stack.sh restart harpocrates`; the page's restart check
   turns green when the signer comes back unsealed with nobody typing
   anything. Reboot the Mac Mini once, later, to prove it (C1.2).

## 5. Backups, before any key exists

| What                                                          | How                                                       | Not with       |
| ------------------------------------------------------------- | --------------------------------------------------------- | -------------- |
| `${DATA_DIR}/olympus/apps/harpocrates/signer` (the key store) | the host's backup                                         | the unseal key |
| `${DATA_DIR}/harpocrates-postgres`                            | `pg_dump` nightly, from `harpocrates-postgres`            |                |
| The unseal key and the recovery passphrase                    | the password manager                                      | the key store  |
| Each offline CA's key file                                    | two offline media, the passphrase in the password manager | the host       |

The key store is useless without the unseal key, and the unseal key
without the store; keep them apart.

## 6. The roots and their CAs

In the console, **Roots → New root**, once per root:

1. The shape, the names and settings decided above, reviewed beside
   their defaults.
2. The root's key is handed over once, encrypted with a passphrase:
   onto both offline media. **Prove the backup** on the root's page
   before anything else: the console counts it unproved until then.
3. Its intermediates and issuing CAs in a ceremony from the root's page
   (and from each intermediate's), each offline key brought back from the
   media for that ceremony only; the ceremony signs the offline CA's
   first list too.

Then point the profiles at their CAs (**Profiles**: `internal-tls`,
`service`, `api-server`, `device`, the signing ones, and the SSH ones once
step 8 is done). `internal-tls` is also `ACME_PROFILE` and
`RENEWAL_TLS_PROFILE`: once it signs, the service issues the renewal
listener its own certificate and `9443` comes up by itself.

Check: the Roots page has no CA needing a ceremony or a proved backup;
each CA's list is at `http://pki.internal.ncfritz.net/crl/<id>.crl`
(`openssl crl -inform DER -noout -text`); and `openssl s_client -connect
pki.internal.ncfritz.net:9443` shows a certificate from the TLS CA.

## 7. Trust the new roots

Each root's certificate (its CA page, **Certificate**) onto the devices
that are to trust it: the Macs' keychains, the phones' profiles, the
NAS, and `NODE_EXTRA_CA_CERTS` where a service needs it. XCA's root stays
trusted beside it until the migration retires it (ADR 0032).

## 8. SSH, ACME, deploy targets

As each is needed, not all at once:

- **SSH**: the user and host CAs on **SSH CAs**, the people mapped on
  **SSH principals**, then hosts and laptops as [the SSH guide](ssh.md)
  sets them up.
- **ACME**: **ACME → New client** for each host whose ACME client is to
  renew from Harpocrates; it reaches
  `https://pki.internal.ncfritz.net:9443/acme/directory`.
- **Deploy targets**: for what nginx serves on the Mac Mini
  ([infra/docker](../../infra/docker/README.md#harpocrates)).

## 9. Monitoring

Load `apps/harpocrates/service/monitoring/harpocrates.rules.yml` into the
monitoring stack's Prometheus and scrape the service as job
`harpocrates` (`harpocrates:3200/metrics`, on the monitoring network).
The rules alert on a sealed signer, lists and OCSP responses near
lapsing or failing, offline CAs' ceremonies coming due, issuing windows
closing, failing renewals and deployments, and endpoints not serving
what they should.

## Rolling back

`OLYMPUS_TAG` back to the previous commit, and
`infra/docker/stack.sh up harpocrates olympus`. Some migrations change
tables (profile versions, for one), so a rollback past one needs the
database restored from the dump taken before the deploy: take one before
every deploy that brings a migration. A rollback never touches the
signer's store.
