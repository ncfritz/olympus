# SSH certificates with Harpocrates

Logging in to the home lab's hosts with SSH certificates instead of
`authorized_keys`, and trusting the hosts without a host-key prompt
([ADR 0035](../decisions/0035-harpocrates-ssh-certificates.md); plan
phase 9; sign-off C15). Harpocrates has two online CAs for this:

- **The user CA** signs a person's own key for a working day (16 hours,
  `ssh-user`), carrying the accounts they are mapped to. A host that
  trusts it lets them in as those accounts.
- **The host CA** signs a host's key for 90 days (`ssh-host`), carrying
  its names. A client that trusts it connects without a prompt, and the
  host renews the certificate itself from day 60.

This guide sets up the Mac Mini and the NAS as hosts and the laptop as a
client, then covers renewal, revocation and rotation. The console's
SSH pages are at `https://control.olympus.ncfritz.net/harpocrates/ca`:
**SSH CAs**, **SSH certificates**, **Principals**, and **My SSH
certificate**, which anyone signed in to Olympus may use.

## Once: the CAs and who logs in as whom

1. **The CAs.** On **SSH CAs**, an admin makes a user CA and a host CA
   (**New CA**: user, then host, number 1, the default maximum validity).
   Each is an Ed25519 key in the signer, made without a ceremony; the
   console shows the line that trusts each.
2. **The host names.** The host CA's line trusts certificates only for
   names matching `SSH_HOST_PATTERN` (`*.internal.ncfritz.net` by
   default, in `infra/docker/env/prod/harpocrates.env`). Connect to the
   hosts by their `internal.ncfritz.net` names, or widen the pattern
   (comma-separated, such as
   `*.internal.ncfritz.net,*.desktop.ncfritz.net`) and restart the
   stack before installing the line anywhere.
3. **Principals.** On **Principals**, an admin maps each Olympus identity
   (its sign-in email) to the accounts it may log in as: `ncfritz`, and
   `admin` on the NAS. Someone with no mapping gets no user certificate.

## The laptop: a client

1. **A key**, if there is none: `ssh-keygen -t ed25519`. It stays on the
   laptop; only `~/.ssh/id_ed25519.pub` goes to Harpocrates.
2. **A certificate.** On **My SSH certificate**, paste the public key
   and **Issue**, then save the file it offers as
   `~/.ssh/id_ed25519-cert.pub`, beside the key. `ssh` offers it with
   the key by itself; for the agent, `ssh-add --apple-use-keychain
~/.ssh/id_ed25519` adds both.
3. **Trusting the hosts.** Add the `@cert-authority` line the same page
   shows to `~/.ssh/known_hosts`, and remove each host's old entry once
   it has a certificate (`ssh-keygen -R <host>`), so the prompt-free
   path is the one used.

The certificate lasts 16 hours: get the next one the same way each
working day. The same key is certified again until it is a year old
(`ssh-user`'s maximum key age), and then a new key is needed.

## A host: the Mac Mini

Everything here runs as root (`sudo -i`). macOS starts `sshd` for each
connection, so a new certificate or setting is read by the next login
with no restart. Remote Login must be on (System Settings, General,
Sharing).

1. **The tools.** The script and its settings:

   ```sh
   install -m 0755 apps/harpocrates/hosts/harpocrates-ssh-host /usr/local/sbin/
   mkdir -p /etc/harpocrates
   install -m 0644 apps/harpocrates/hosts/ssh-host.env.example /etc/harpocrates/ssh-host.env
   ```

   The renewal listener's certificate chains to a root Harpocrates
   publishes; save that root as PEM where `HARPOCRATES_CA_FILE` says
   (the root's slug is on its CA page):

   ```sh
   curl -s http://pki.internal.ncfritz.net/ca/<root>.crt |
     openssl x509 -inform DER -out /etc/harpocrates/root.pem
   ```

   `RESTART_COMMAND` stays unset on a Mac.

2. **The KRL first.** `sshd` refuses every key when the file
   `RevokedKeys` names cannot be read, so fetch it before naming it:

   ```sh
   harpocrates-ssh-host krl
   ssh-keygen -Q -l -f /etc/ssh/revoked_keys     # "# KRL version …"
   ```

3. **The first host certificate.** On **SSH certificates**, an admin
   chooses **Host certificate**, pastes `/etc/ssh/ssh_host_ed25519_key.pub`
   and gives every name clients use for the host, the full one first.
   Save the certificate as `/etc/ssh/ssh_host_ed25519_key-cert.pub`
   (mode 0644).

4. **The user CAs.** Save each active user CA's line from **SSH CAs**
   (both generations during a rotation), one per line, as
   `/etc/ssh/harpocrates_user_cas.pub`.

5. **`sshd`'s settings**, in `/etc/ssh/sshd_config.d/100-harpocrates.conf`
   (macOS's `sshd_config` includes that directory first, so these win):

   ```
   HostCertificate /etc/ssh/ssh_host_ed25519_key-cert.pub
   TrustedUserCAKeys /etc/ssh/harpocrates_user_cas.pub
   RevokedKeys /etc/ssh/revoked_keys
   ```

   `sshd -t` checks them. A user certificate lets its holder in as any
   account among its principals; `authorized_keys` keeps working beside
   it until it is emptied.

6. **Renewal and the KRL, hourly**, from launchd:

   ```sh
   install -m 0644 -o root -g wheel apps/harpocrates/hosts/net.ncfritz.harpocrates-ssh-host.plist /Library/LaunchDaemons/
   launchctl bootstrap system /Library/LaunchDaemons/net.ncfritz.harpocrates-ssh-host.plist
   ```

   It logs to `/var/log/harpocrates-ssh-host.log`: "not due until …"
   until day 60, then "renewed …".

## A host: the NAS

The same as the Mac Mini, with DSM's differences. Its OpenSSH must be
8.1 or later for `ssh-keygen -Y sign` (`ssh -V`).

- **Where things live.** Keep the script, its settings and the root on a
  volume, which DSM's updates leave alone (a folder in a shared folder
  only admins can read, such as `/volume1/admin/harpocrates/`), and point
  the script at the settings with `HARPOCRATES_SSH_HOST_CONFIG`.
- **`sshd`'s settings** go at the end of `/etc/ssh/sshd_config`; DSM
  has no `sshd_config.d`. DSM rewrites the file when SSH is changed in
  Control Panel and on some updates: check it after either, with
  `sshd -T | grep -Ei 'hostcertificate|trustedusercakeys|revokedkeys'`.
- **A restart.** DSM's `sshd` is a running service, so set
  `RESTART_COMMAND="systemctl restart sshd"` (`systemctl status sshd`
  first confirms the unit's name).
- **Hourly**, from Control Panel, Task Scheduler: a scheduled task, a
  user-defined script, run as root every hour:

  ```sh
  export HARPOCRATES_SSH_HOST_CONFIG=/volume1/admin/harpocrates/ssh-host.env
  /volume1/admin/harpocrates/harpocrates-ssh-host krl
  /volume1/admin/harpocrates/harpocrates-ssh-host renew
  ```

  With "Send run details by email" on, a failure arrives by mail.

## Checking it

From the laptop, with a fresh user certificate:

```sh
ssh -v ncfritz@<host>.internal.ncfritz.net 2>&1 |
  grep -E 'Server host certificate|Offering public key|Authenticated'
```

- `Server host certificate: ssh-ed25519-cert-v01@openssh.com … ID <host>…`,
  and no prompt: the host CA vouches for it (C15.2).
- `Offering public key: … ED25519-CERT` and `Authenticated … using
"publickey"`: the user CA let you in (C15.1).
- `ssh-keygen -L -f ~/.ssh/id_ed25519-cert.pub` shows its principals and
  its 16 hours.

## Renewal

- **Hosts** renew themselves (`harpocrates-ssh-host renew`): the script
  asks Harpocrates's renewal listener (`9443`) for a challenge with the
  current certificate, signs it with the host key (`ssh-keygen -Y sign`,
  namespace `harpocrates-ssh-renew`) and gets the next certificate, for
  the same key and names, under the same profile version. Nothing but
  the host key is needed. It replaces the file atomically and runs
  `RESTART_COMMAND`.
- A host whose certificate expired or was revoked cannot renew it
  (`422`, `403`): an admin issues it a new one, as at first.
- **People** get a new user certificate each day on **My SSH
  certificate**.

## Revocation

- **A user certificate**: revoke it on **SSH certificates**. Its CA's KRL
  lists it at once, and hosts refuse it at their next hourly `krl`; run
  `harpocrates-ssh-host krl` on a host to apply it now (C15.3).
  `keyCompromise` also blocks the key and revokes its other SSH
  certificates. Removing someone's mapping stops new certificates;
  revoking theirs stops the current one.
- **A host certificate**: revoke it, then issue the host a new one for a
  new host key. Clients that should refuse the old one name the host
  CAs' KRL in `ssh_config` (`RevokedHostKeys`), fetched like the user
  CAs' (`https://pki.internal.ncfritz.net:9443/v1/ssh/krl/host`).
- Hosts fetch one KRL for every user CA (`/v1/ssh/krl/user` on the
  renewal listener, over HTTPS, since a KRL is not signed); it covers
  both generations during a rotation.

## Rotation

A CA is replaced by its next generation, trusted beside the old until
nothing the old one signed is in use.

- **The user CA**: **Next generation** on its row. Add the new line to
  every host's `harpocrates_user_cas.pub`, beside the old; new
  certificates come from it at once (C15.7). Retire the old CA then; once
  its last certificate has expired (16 hours under `ssh-user`, a week at
  most), remove its line.
- **The host CA**: **Next generation**, then add its `@cert-authority`
  line to every client's `known_hosts`, beside the old. Hosts move to it
  as they renew, within 60 days; once every host has, retire the old CA,
  and remove its line once its last certificate expires.

Profiles not pinned to a CA follow the newest active one of their type,
so a rotation needs no profile change.

## When it goes wrong

| What the script or `ssh -v` says                            | Why, and what to do                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `no challenge (HTTP 404)`: Harpocrates did not issue it     | The certificate file is not the one Harpocrates issued (replaced, or another CA's). An admin issues the host a new one.              |
| `no challenge (HTTP 403)` or `(HTTP 422)`                   | Revoked, or expired: an admin issues the host a new one.                                                                             |
| `no challenge (HTTP 409)`: renewed already                  | The file is an older certificate than the newest; put the newest back (**SSH certificates**, the host's current one, download).      |
| `not renewed (HTTP 403)`: not signed by the certificate key | `HOST_KEY` is not the key the certificate is for.                                                                                    |
| curl: SSL certificate problem                               | `HARPOCRATES_CA_FILE` is not the root the renewal listener's certificate chains to.                                                  |
| `ssh` prompts for the host key                              | The name connected to is not among the certificate's principals, or not covered by the `@cert-authority` line's pattern.             |
| `Permission denied (publickey)` with a fresh certificate    | The account is not among its principals; the host does not have the CA's line; or the KRL file is missing (`sshd`'s log says which). |
