# The console generator

`pnpm gen console` scaffolds a console for Olympus Control and registers it
in the four places it has to be registered
([ADR 0021](../decisions/0021-control-host-and-console-navigation.md)). That
is the reason it exists: a console missing from one of them is invisible,
unbuilt or unreachable, and which one is not obvious from the console
itself.

## What it asks

| Prompt             | What it decides                                                                |
| ------------------ | ------------------------------------------------------------------------------ |
| Property, name     | The key `<property>/<console>`, and everything derived from it                 |
| Label, description | The sider's row and the index's card                                           |
| Where it lives     | `agents/<agent>/console` beside its agent, or `apps/<name>-console` on its own |
| Port               | What the console listens on inside its image                                   |
| Its own agent?     | Whether nginx also publishes an agent under it, and on which port              |

A property that is not in the registry yet is added, with the label you
give it.

## What it writes

The package — a Next.js app on the shared shell, with one page, one tab and
(with an agent) a session — and then:

| File                               | What it adds                             |
| ---------------------------------- | ---------------------------------------- |
| `packages/console/src/registry.ts` | The entry every console's sider renders  |
| `docker-bake.hcl`                  | A target, with the base path baked in    |
| `infra/docker/compose/olympus.yml` | The service                              |
| `infra/docker/nginx/control.conf`  | The console's locations, and its agent's |

Anything it cannot find an anchor for stops the generator rather than
leaving the console half registered.

## Afterwards

1. `pnpm install`.
2. Add the console's key to `CONTROL_CONSOLES` in
   `infra/docker/env/<host>.env` for each host that runs it — a host's menu
   is what it can actually reach.
3. `pnpm --filter <package> dev`, and build its pages.
4. With an agent: the generator does not scaffold one. Give it
   `AUTH_BASE_URL=https://${CONTROL_HOST}/<property>/<console>/api` and
   `WEB_APP_URL=https://${CONTROL_HOST}/<property>/<console>` — those two
   scope its session cookie and bound where a login may return to — and a
   Compose service named `<property>-<console>-agent`.
5. The typed API client comes later: it is generated from the agent's
   committed OpenAPI document (ADR 0016), so add a `generate` script and
   `createConsoleClient<paths>` once that document exists.
