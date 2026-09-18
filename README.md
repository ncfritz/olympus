# Olympus

Monorepo for the Olympus platform: API, model, SDK, site, desktop shell and
asynchronous agents.

```
apps/       api, site, desktop (and Minerva calendar sync)
agents/     RabbitMQ workers
packages/   config, model, sdk, ui, theme, shared
infra/      hasura/, docker/
turbo/      generators/
docs/       architecture, conventions, decisions, guides, roadmap
```

## Getting started

Requires Node 26 (`.nvmrc`) and pnpm 10.

```sh
npm i -g pnpm@10     # Node 26 no longer bundles Corepack
pnpm install
pnpm build           # turbo run build
pnpm test
pnpm lint
pnpm check:conventions
```

Run a task for one package and its dependencies:

```sh
pnpm turbo run build --filter=@ncfritz/olympus-api...
```

## Documentation

Start at [docs/README.md](docs/README.md). Before writing code, read the
[conventions](docs/conventions/README.md) for the area you're working in.
