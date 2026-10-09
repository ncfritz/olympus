# @ncfritz/olympus-console

The shell every Olympus Control console wears
([ADR 0021](../../docs/decisions/0021-control-host-and-console-navigation.md)):
the suite's registry, its navigation, the theme, sign-in, and the client a
console calls its own agent with.

Consoles are separate Next.js applications published under one host
(`control.olympus.ncfritz.net`) at `/<property>/<console>`. Moving between
two of them is a document load, not a route change, so the part of the
chrome that spans the suite is rendered from shared, static knowledge and
looks identical in every image.

| Level               | Control             | Comes from                         |
| ------------------- | ------------------- | ---------------------------------- |
| The consoles        | the fixed rail      | `PROPERTIES`, narrowed by the host |
| The console's pages | the sider beside it | the console, as `pages`            |
| Where you are       | the header's trail  | both of the above                  |

It is arranged as the main Olympus site is. A fixed rail of glyphs holds
the suite — Control, then every console the host runs — and does not
collapse: it is the one thing on the screen that is the same in every
console image. Beside it, this console's own pages, as a light panel that
collapses to a second rail behind a pill on its edge, at eye height
rather than at the foot. The header carries the wordmark, the trail and
the session, and no navigation at all.

The properties are not rows in the rail. A property is how a console is
_named_ — `minerva/calendar`, and so its path, image and metrics client —
not anywhere a person can go, and a rail is too narrow to say both. The
tooltip carries it, for the day two properties have a Calendar.

The collapsed state is stored per browser, not held in React: crossing
the suite is a document load, and a sider that springs open every time is
not a choice.

## Using it

This package is consumed as **source**: it is `"use client"` React, so
each console adds it to `transpilePackages` in `next.config.ts` rather
than importing a build.

The root layout is a server component, and is where the one thing that is
not baked into the image is read:

```tsx
// app/layout.tsx
import { readShellConfig } from "@ncfritz/olympus-console";

const { nav, origin } = readShellConfig();
```

- **`CONTROL_CONSOLES`** — the `<property>/<console>` keys this host runs,
  comma-separated. Unset means the whole registry, which is what the
  workspace wants.
- **`CONTROL_ORIGIN`** — where the suite is, when it is not this origin.
  Set it in the workspace to point a console's sidebar at the home lab's.

The shell itself is presentational: it routes nothing and fetches nothing.
A console's own client layout supplies the session and the tabs.

```tsx
"use client";
const auth = useConsoleAuth({ apiUrl: API_URL });
return (
  <ControlShell
    nav={nav}
    current="minerva/calendar"
    origin={origin}
    auth={auth}
    pages={PAGES}
    activePage={usePathname()}
    onNavigate={(href) => router.push(href)}
    logo={<img src="/header.png" alt="Olympus" height={64} />}
    signIn={[{ name: "google", label: "Sign in with Google" }]}
  >
    {children}
  </ControlShell>
);
```

A page is `{ key, label, icon, href }`, and a section is one with
`children` and no `href` of its own. The icon is not optional: collapsed,
it is the whole of the row. Each row is an anchor, so a page can be
opened in a new tab and the address bar is the address — `onNavigate`
takes over only the plain left click, which is the one a router does
better than a document load.

`logo` is the suite's wordmark, at the head of the bar. The application
passes it because the application serves the file; the shell has no
`public/` of its own. It is the header's own height, 64px; 80px wide sits
it over the rail, and 380px over the rail and the open sider both.

Nothing supplies the breadcrumbs. They are read off `nav`, `current`,
`pages` and `activePage` — the suite, the property, the console, then the
page and whatever section it is under.

## The registry

`PROPERTIES` in `src/registry.ts` is the suite's map, and the key
`<property>/<console>` is what everything else is derived from: the path,
the Docker image and Compose service names, and the `X-Olympus-Client`
value (ADR 0017). An entry is added when its console is **built**, not
when it is planned — a menu row that 404s is worse than a short menu.

An entry also names an `icon`, which is the whole of its row in the
collapsed rail and the avatar on the index. It is a name rather than a
component, because `readShellConfig` reads this module on the server and
it stays plain data; `src/shell/icons.tsx` is where the names are drawn,
and the only place the suite's glyphs are chosen.

## Styles

The components use inline style objects, which the shared React ESLint
config warns about. They are a faithful move of the Minerva console's
chrome, and they stay that way until the styles mechanism is decided
(`antd-style` vs. CSS modules, roadmap 7 and ADR 0012); converting them
twice would be the waste.
