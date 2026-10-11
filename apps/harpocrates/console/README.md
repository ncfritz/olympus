# @ncfritz/harpocrates-ca-console

The Harpocrates CA console: the signer's setup and seal, roots,
ceremonies, certificates, profiles and the audit log (ADR 0020, 0032).

It is published at `/harpocrates/ca` on the control host
([ADR 0021](../../../docs/decisions/0021-control-host-and-console-navigation.md)),
inside the shared shell from `@ncfritz/olympus-console`: the suite in the
rail, this console's own pages in the sider beside it (`PAGES` in
`src/components/AppLayout.tsx`). The Harpocrates service is published
under it at `/harpocrates/ca/api`, and the console signs in through it
(ADR 0029): the session is the service's httpOnly cookies, so the console
never sees a token.

| Page                                  | What it does                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | The signer's seal (unseal, seal), the hierarchy and certificates at a glance                                                                                                                                                                                                                                                                             |
| `/setup`                              | First run: recovery passphrase, the unseal key shown once, the restart check                                                                                                                                                                                                                                                                             |
| `/roots`                              | Each root, its shape, whether its backup is proved, and the CAs beneath it                                                                                                                                                                                                                                                                               |
| `/roots/new`                          | Shape, name and settings reviewed beside their defaults, the key handed over once                                                                                                                                                                                                                                                                        |
| `/ca?id=`                             | One CA: its rules, what it signed, its lists; discard an unused root. A CA that signs leaves has its issuer alternative names edited here. An offline CA opens a ceremony in a dialog and lists its past ones; while one is open (the signer holds one at a time), it says whose and offers to close it. `&ceremony=open` opens the dialog with the page |
| `/ceremony?id=`                       | Sign what the CA signs (intermediates, issuing CAs or leaves), its list; close it                                                                                                                                                                                                                                                                        |
| `/certificates`                       | Search, download, export an escrowed key                                                                                                                                                                                                                                                                                                                 |
| `/certificates/new`                   | Issue under a profile's latest version: its subject attributes, name types, usages and key types decide the form                                                                                                                                                                                                                                         |
| `/profiles`                           | Profiles, active or all; `?id=` one: its settings with help on each, its versions and a diff between any two, a preview; edit, copy a version into a new profile, deactivate, reactivate                                                                                                                                                                 |
| `/profiles/new`, `/profiles/edit?id=` | The editor, in sections with help on every setting, the certificate its settings would produce beside it as they change; a change of settings saves the next version (ADR 0034)                                                                                                                                                                          |

Every new CA is previewed by the service (`POST /v1/issuers/preview`)
before anything is signed, so the review shows exactly what creating it
would do and why it would be refused; every profile version is previewed
the same way (`POST /v1/profiles/preview`), the signer building a sample
certificate with a throwaway key.

## Development

`pnpm generate` writes `src/generated/api.d.ts` from the service's
committed OpenAPI document. Run the service (`apps/harpocrates/service`,
port 3200) with `OLYMPUS_API_URL`, `AUTH_BASE_URL=http://localhost:3200`
and `WEB_APP_URL=http://localhost:4394`, copy `.env.local.example` to
`.env.local`, then `pnpm dev`.
