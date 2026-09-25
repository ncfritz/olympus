# apps/

Deployable applications that serve HTTP or UI.

| Directory     | Source repo                  | Status           |
| ------------- | ---------------------------- | ---------------- |
| `api`         | olympus-api                  | imported         |
| `control`     | —                            | present          |
| `site`        | olympus-site                 | not yet imported |
| `desktop`     | olympus-app (Electron shell) | not yet imported |
| `harpocrates` | —                            | in progress      |

`control` is the Olympus Control index (ADR 0021): the page at the root of
the control host, listing the consoles it runs.

`harpocrates` is the internal certificate authority (ADR 0020): two
packages in one directory, `service/` (NestJS) and `signer/` (Python),
built and deployed together.

Minerva calendar sync (currently its own monorepo with `apps/api` and
`apps/web`) will land here as well; its layout is an open item in
`docs/roadmap.md`.
