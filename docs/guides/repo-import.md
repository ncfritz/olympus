# Importing an existing repository

Repositories are imported one at a time, with history (ADR 0001). Each
import is its own commit series and leaves the workspace building.

## Order

Dependencies first, so each import can switch to `workspace:*` right away:

1. `olympus-model` → `packages/model`
2. `olympus-api` → `apps/api` (then build the `api-operation` generator and
   convention checks, ADR 0008/0009)
3. `olympus-sdk` → `packages/sdk`
4. `olympus-notification-agent` → `agents/olympus-notification`
5. `dionysus-search-agents` → `agents/dionysus-search`
6. `dionysus-metadata-agents` → `agents/dionysus-metadata`
7. `dionysus-asset-agents` → `agents/dionysus-asset`
8. `olympus-site` → `apps/site`
9. `olympus-app` → `apps/desktop` (not a git repository; copied in as a new
   commit)
10. `minerva-calendar-sync` → layout decided at import (ADR 0003)

## Before importing

- Inspect the source repos read-only. Use `git --no-optional-locks status`;
  a plain `git status` from the Cowork VM can leave a stale
  `.git/index.lock` behind.

- Commit or stash outstanding work in the source repo. Only committed
  history is imported. As of 2026-09-18 several repos have uncommitted
  changes (olympus-api: 10 files, olympus-notification-agent: 21).
- Check that no secrets are in history (`git log -p -- '*.env'`,
  `gitleaks detect`). `*.env` files are not tracked in the repos checked so
  far.

## Steps (per repo)

```sh
# 1. Rewrite a fresh clone so every path sits under the target directory
git clone --no-tags --single-branch -b main <source> /tmp/import-<name>
cd /tmp/import-<name>
git filter-repo --to-subdirectory-filter <target-dir>   # e.g. packages/model

# 2. Merge it into the monorepo, keeping history
cd <monorepo>
git remote add import-<name> /tmp/import-<name>
git fetch import-<name>
git merge --allow-unrelated-histories import-<name>/main \
  -m "Import <name> into <target-dir> with history"
git remote remove import-<name>
```

Then, in a follow-up commit ("Adapt <name> to workspace"):

- `package.json`: keep `name`; set `"private": true`, `"version": "0.0.0"`;
  replace `@ncfritz/*` deps with `"workspace:*"`; move shared third-party
  deps to `"catalog:"`; remove `husky`, `semantic-release`, `is-ci`,
  `prepare`, and duplicated lint/format devDependencies.
- `tsconfig.json`: extend `@ncfritz/olympus-config/tsconfig/<preset>.json`,
  keeping only package-specific overrides.
- `eslint.config.mjs`: spread the shared config.
- Delete per-repo `.husky/`, `release.config.*`, `package-lock.json`,
  `*.iml`, `.github/workflows/*` publishing jobs.
- Add `*.env.example` for every env file the package reads.
- `pnpm install && pnpm turbo run build lint --filter=<name>...` passes.

Tags are not imported: each repo has its own `vX.Y.Z` tags, and they would
collide.

Uncommitted changes in the source repo are carried over as uncommitted
changes in the monorepo working tree (`git diff` in the source with
`--src-prefix/--dst-prefix` set to the target directory, then
`git apply`), so in-progress work continues there.

## After importing

- Archive the source repository on GitHub, with a README pointing here.
- Update the status tables in `apps/README.md`, `agents/README.md` or
  `packages/README.md`.
- The `olympus-release` tool (`@ncfritz/release-cascade-orchestrator`)
  exists to cascade versions across these repos. It is retired once the
  model, API and SDK are imported.
