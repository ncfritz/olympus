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

| Level                | Control     | Comes from                         |
| -------------------- | ----------- | ---------------------------------- |
| Property and console | the sider   | `PROPERTIES`, narrowed by the host |
| The console's pages  | header tabs | the console, as `tabs`             |

The sider collapses the way the main Olympus site's does: a pill on its
edge, at eye height rather than at the foot, and a rail of icons rather
than nothing. Collapsed, the property headings go — a heading with no
room for its text is worse than none — and each console is its glyph, its
tooltip and its link. It is the only control for it; the header has
none.

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
    tabs={TABS}
    activeTab={usePathname()}
    logo={<img src="/header.png" alt="Olympus" height={64} />}
    signIn={[{ name: "google", label: "Sign in with Google" }]}
  >
    {children}
  </ControlShell>
);
```

`logo` is the suite's wordmark, at the head of the bar. The application
passes it because the application serves the file; the shell has no
`public/` of its own. It is the header's own height, 64px, and about the
width of the open sider so the two line up.

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
