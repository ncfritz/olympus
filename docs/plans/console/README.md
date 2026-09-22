# Olympus Control: the console suite

The implementation of
[ADR 0021](../../decisions/0021-control-host-and-console-navigation.md).
It rests on the Docker work ([plan](../docker/README.md)) for the images,
Compose services and nginx blocks it changes, and it finishes only after
[authentication](../authentication/README.md) phase 3, which gives the
suite one session instead of one per console.

| Phase | Delivers                                                           | Where    | Depends on   |
| ----- | ------------------------------------------------------------------ | -------- | ------------ |
| 1     | `packages/console`: the registry, the shell, the first React tests | repo     | —            |
| 2     | Minerva calendar moves under the control host                      | repo     | 1            |
| 3     | The index at `/`                                                   | repo     | 1            |
| 4     | Cutover: DNS, certificate, OAuth redirect URIs, nginx              | Mac Mini | 2, docker 4  |
| 5     | The console generator, and the second console                      | repo     | 2            |
| 6     | One session across the suite                                       | repo     | auth phase 3 |

Nothing here is live yet: Minerva sits behind the `minerva` Compose
profile with its environment unfilled, so the service, image and volume
renames in phase 2 cost nothing and need no migration.

## Phase 1 — The shell package (done 2026-09-22)

`packages/console`, `@ncfritz/olympus-console`. Consumed from the
workspace as source (ADR 0002) with `transpilePackages` in each console's
`next.config.ts`, rather than built to `dist`: the package is `"use
client"` React, and Next's standalone build already compiles workspace
packages into the output the image copies.

1. **The registry.** `PROPERTIES`: property key, label, and its consoles
   (key, label, path, icon). One file, hand-maintained, the suite's only
   shared knowledge.
2. **`visibleConsoles(registry, CONTROL_CONSOLES)`.** A comma-separated
   list of `<property>/<console>` keys filters the registry; unset means
   all of it, which is what the workspace wants. Empty properties drop
   out.
3. **`<ControlShell nav current tabs>`.** AntD `Layout` with a `Sider`
   holding the property groups (always expanded, `current` marking the
   active console) and a `Header` holding the console's name, the tab
   strip, the theme control and the user menu. Narrow screens put the
   sider in a drawer and scroll the tabs.
4. **Theme mode**, moved out of the Minerva console as it stands
   (`lib/theme.ts`, `lib/ThemeModeContext.tsx`) — a behaviour-preserving
   move, no token changes. ADR 0012's theme package can absorb it later.
5. **`useAuth`** and **`createConsoleClient({ key, basePath })`**: an
   `openapi-fetch` client on `${basePath}/api` with `credentials:
"include"` and `X-Olympus-Client` set to the console's derived name
   (`minerva-calendar-console`), which satisfies the client-name rule in
   ADR 0017.
6. **`consoleHref(entry, origin)`** — a plain `href`, absolute when
   `CONTROL_ORIGIN` is set (so a console running from the IDE can link
   into the home lab's suite), relative otherwise. Cross-console links
   are `<a>`, never `next/link`.
7. **Tests**, in `test/`: registry filtering, the active-state
   resolution, href building, and a render test asserting the groups, the
   current console and the tab strip. This is the repository's first
   React test setup — vitest with `jsdom` and `@testing-library/react`,
   versions in the catalog, picked up by the existing Turbo `test` task.

Fifty-one tests. Two things came out of building it: the shell takes the
session as a prop rather than calling `useConsoleAuth` itself, which keeps
it presentational and testable without stubbing a fetch; and the client's
base URL is resolved against the document's origin, because `Request`
rejects a relative one anywhere other than a browser's own `fetch`. The
React versions the shell shares with the console moved into the catalog
(ADR 0002). Its inline styles keep the shared config's warning until the
styles mechanism is decided (roadmap 7).

## Phase 2 — Minerva calendar moves (done 2026-09-22)

### The console

1. `next.config.ts`: `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? ""`,
   keeping `output: "standalone"` and `outputFileTracingRoot`. No
   `assetPrefix` — `basePath` already moves `_next/static`, and every
   link is a root-relative `next/link` and every image a `next/image`,
   both of which take the prefix automatically. `usePathname()` returns
   the path without it, so the existing active-tab logic is unaffected.
2. `app/layout.tsx` (a server component) resolves the nav from
   `CONTROL_CONSOLES` / `CONTROL_ORIGIN` and renders `<ControlShell
current="minerva/calendar" tabs={...}>`.
3. `components/AppLayout.tsx` keeps what is Minerva's — the timeline
   settings provider, the timezone picker — and gives up the menu, the
   theme control and the sign-in/out UI to the shell. Today's
   `NAV_ITEMS` become the tab strip.
4. `lib/api/client.ts`: `BASE_PATH`, the client from the shell factory,
   and `loginUrl`'s `returnTo` becomes
   `${window.location.origin}${BASE_PATH}` — without that, sign-in lands
   at the suite root instead of back in the console.

### The agent, three fixes

One commit each, each with a test, before the wiring changes:

1. **`sanitizeReturnTo` compares origins only.** On a shared host that
   now lets one console's login redirect into another. It must require
   the configured web app's path prefix as well.
2. **The session cookies set no `path`**, so Express defaults to `/` and
   `minerva_access_token` is sent to every console on the control host.
   The path comes from `WEB_APP_URL`'s pathname (`/` when unset).
3. **`secure: request.secure` with no `trust proxy` anywhere in the
   workspace**, so behind nginx the session cookie is issued without
   `Secure` today. Trust the proxy (or read `X-Forwarded-Proto`) so it is
   set. This one is a defect of its own, not a consequence of the move.

### The wiring

5. `docker-bake.hcl`: `minerva-console` → `minerva-calendar-console` with
   `NEXT_PUBLIC_BASE_PATH=/minerva/calendar` and
   `NEXT_PUBLIC_API_URL=/minerva/calendar/api`; `minerva-agent` →
   `minerva-calendar-agent`.
6. `infra/docker/compose/olympus.yml`: the two services renamed to match,
   `AUTH_BASE_URL: https://${CONTROL_HOST:?}/minerva/calendar/api`,
   `WEB_APP_URL: https://${CONTROL_HOST:?}/minerva/calendar`, and
   `CONTROL_CONSOLES` / `CONTROL_ORIGIN` on the console service.
   `minerva-migrate` and the data volume follow the rename.
7. `infra/docker/env/{mac-mini,laptop}.env`: `MINERVA_HOST` →
   `CONTROL_HOST` (`control.olympus.internal.ncfritz.net`,
   `control.olympus.localhost`), plus each host's `CONTROL_CONSOLES`.
8. `infra/docker/nginx/control.conf`, a file of its own since it grows
   per console: one server block for `${CONTROL_HOST}`, the proxy headers
   hoisted to server level, and two locations per console —
   `/minerva/calendar/api/` rewritten onto the agent, `/minerva/calendar`
   onto the console, its `_next` assets included. Services are still
   found through Docker's DNS with a variable each, so nginx starts with
   any of them down. The `minerva.internal.ncfritz.net` block leaves
   `olympus.conf`.
9. `dev.env.example` / `local.env.example` / `.env.local.example`: the
   workspace keeps running at the root (no base path), with
   `CONTROL_ORIGIN` documented for pointing the sidebar's other consoles
   at the home lab.

### Verifying

Done, and what it turned up:

- The console builds and runs with `NEXT_PUBLIC_BASE_PATH=/minerva/calendar`:
  the standalone server 404s `/` and serves the console with its assets
  under the base path.
- `docker compose config` renders for both hosts with the renamed
  services.
- `control.conf` in front of stand-in backends: the console, its `_next`
  assets, the agent with the prefix stripped, and `/` redirecting until
  the index exists. The agent's stanza uses the Olympus API's
  encoding-preserving idiom (`$request_uri` rather than the decoded
  `$uri`), so a path segment containing `%2F` reaches the agent intact —
  the Minerva block it replaces decoded it.
- The root layout is `force-dynamic`: `CONTROL_CONSOLES` is read per
  request, and a prerendered layout would have carried the build
  machine's value.

Two things fell out of the move. The console's header wordmark is gone —
the shell's header names the console (`Minerva · Calendar`) and the
sider names the suite, so `public/header.webp` is now unused; a `brand`
slot can come back if the suite wants per-console marks. And
`NEXT_PUBLIC_API_URL` is no longer a build argument: the client derives
the agent's path from the console's key, so the path and the base path
cannot disagree. The workspace still sets it, since the agent has a port
of its own there.

## Phase 3 — The index

1. `apps/control` (`@ncfritz/olympus-control`), base path `/`, the same
   shell with no tab strip: a card per property listing its consoles.
2. A bake target, a Compose service and `location = /` in `control.conf`.
   It replaces the interim redirect to a default console.
3. Service health on the cards is deliberately deferred (ADR 0021, Open)
   — it wants the monitoring work, not a fan-out of `/health` from a
   browser.

## Phase 4 — Cutover

On the Mac Mini, after the Docker plan's phase 4, in this order:

1. The DNS record and certificate for
   `control.olympus.internal.ncfritz.net` (the external
   `control.olympus.ncfritz.net` when split-horizon DNS lands, on one
   certificate).
2. **Re-register the OAuth redirect URIs first** — the Google _web_
   client and the Microsoft app registration, to
   `https://<control host>/minerva/calendar/api/auth/callback/<provider>`.
   Sign-in is broken between the nginx change and this, so it goes first.
3. nginx: add `control.conf`, drop the Minerva server block, reload.
4. `stack.sh up olympus` with the renamed services, the `minerva` profile
   on.
5. Retire `minerva.internal.ncfritz.net`: its record, its certificate and
   its `/config/ssl` files.

## Phase 5 — The generator, and the second console

1. `pnpm gen console <property> <name>`: the package (under
   `agents/<name>/console` or `apps/<name>-console`), its registry entry,
   bake target, Compose service and nginx stanza — the five places ADR
   0021 says a console touches, so none of them is forgotten.
2. The first console built with it proves the pattern across properties:
   the CA console (ADR 0020) or the notifications console, whichever work
   lands first.

## Phase 6 — One session across the suite

After authentication phase 3:

1. The session cookie moves to the control root, and the per-console
   cookie paths from phase 2 are retired.
2. The shell's user menu becomes suite-wide: sign in once, sign out once.
3. The index becomes where sign-in lands.
