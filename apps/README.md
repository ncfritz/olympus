# apps/

Deployable applications that serve HTTP or UI.

| Directory | Source repo                  | Status           |
| --------- | ---------------------------- | ---------------- |
| `api`     | olympus-api                  | imported         |
| `control` | —                            | present          |
| `site`    | olympus-site                 | not yet imported |
| `desktop` | olympus-app (Electron shell) | not yet imported |

`control` is the Olympus Control index (ADR 0021): the page at the root of
the control host, listing the consoles it runs.

Minerva calendar sync (currently its own monorepo with `apps/api` and
`apps/web`) will land here as well; its layout is an open item in
`docs/roadmap.md`.
