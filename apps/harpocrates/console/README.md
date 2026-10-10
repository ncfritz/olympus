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

| Page            | What it does                                                                      |
| --------------- | --------------------------------------------------------------------------------- |
| `/`             | The signer's seal (unseal, seal), the hierarchy and certificates at a glance      |
| `/setup`        | First run: recovery passphrase, the unseal key shown once, the restart check      |
| `/roots`        | Each root, its shape, whether its backup is proved, and the CAs beneath it        |
| `/roots/new`    | Shape, name and settings reviewed beside their defaults, the key handed over once |
| `/ca?id=`       | One CA: its rules, what is beneath it, its lists; discard an unused root          |
| `/ceremonies`   | The open ceremony, and the offline CAs that can hold one                          |
| `/ceremony?id=` | Sign what the CA signs (intermediates, issuing CAs or leaves), its list; close it |
| `/certificates` | Search, download, export an escrowed key                                          |

Every new CA is previewed by the service (`POST /v1/issuers/preview`)
before anything is signed, so the review shows exactly what creating it
would do and why it would be refused.

## Development

`pnpm generate` writes `src/generated/api.d.ts` from the service's
committed OpenAPI document. Run the service (`apps/harpocrates/service`,
port 3200) with `OLYMPUS_API_URL`, `AUTH_BASE_URL=http://localhost:3200`
and `WEB_APP_URL=http://localhost:4394`, copy `.env.local.example` to
`.env.local`, then `pnpm dev`.
