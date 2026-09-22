# 0021. The control host and console navigation

- **Status:** Accepted
- **Date:** 2026-09-22

## Context

[ADR 0016](0016-agents-with-a-management-console.md) gave an agent a console
and left it there: `agents/<name>/console`, talking to its own agent. It
said nothing about where a console is published or what it looks like next
to another one. Minerva's went up on a name of its own,
`minerva.internal.ncfritz.net`, with the agent under `/api`
([ADR 0019](0019-compose-stacks-and-configuration.md)).

That does not survive the consoles that are coming. The platform is a
hierarchy — Olympus over Dionysus and Minerva — and each property wants
several:

| Property | Consoles                                                                           |
| -------- | ---------------------------------------------------------------------------------- |
| Olympus  | notifications, deployment, CA ([ADR 0020](0020-internal-certificate-authority.md)) |
| Dionysus | metadata, search, assets                                                           |
| Minerva  | calendar, document indexing                                                        |

Nine names, nine DNS records, nine certificates, nine sets of cookies — and
nothing telling a visitor to one of them that the other eight exist. Two
constraints shape the answer:

- **Each console is a separately built, separately deployed Next.js app.**
  Moving between two of them is a full document load, not client-side
  routing. The seam between consoles is a deployment seam.
- **A console never reaches past its own agent** (ADR 0016). Whatever
  spans the suite has to be a small amount of shared, static knowledge, not
  a service.

## Decision

### One host

The suite is **Olympus Control**, published at
`control.olympus.ncfritz.net`. Until split-horizon DNS lands, the internal
name is `control.olympus.internal.ncfritz.net`; afterwards one name
resolves inside and out, with one certificate. Hosts name it once, as
`CONTROL_HOST`.

### The path is the hierarchy

A console is published at `/<property>/<console>`, and its agent under that
console's own `/api`:

| Console           | Path                 | Agent                    |
| ----------------- | -------------------- | ------------------------ |
| Minerva calendar  | `/minerva/calendar`  | `/minerva/calendar/api`  |
| Dionysus metadata | `/dionysus/metadata` | `/dionysus/metadata/api` |
| Olympus CA        | `/olympus/ca`        | `/olympus/ca/api`        |

The property in the path is not decoration: Dionysus has a search console
and Olympus will want one, and without it the two collide. It also groups
the nginx stanzas, and scopes each console's cookies to its own subtree.

Everything else is derived from that key. A package keeps the name of its
directory, but the Docker image, the Compose service and the metrics client
name (ADR 0017, which requires `[a-z][a-z0-9-]*`) are
`<property>-<console>-console` and `<property>-<console>-agent`:
`minerva-calendar-console`, `minerva-calendar-agent`.

### Three levels of chrome, split along the deployment seam

```
┌──────────────────┬──────────────────────────────────────────┐
│ Olympus Control  │  Calendar          [ Events | Calendars  │
│                  │                      | Sync | Publish ]  │
│ OLYMPUS          ├──────────────────────────────────────────┤
│   Notifications  │                                          │
│   Deployment     │                                          │
│   CA             │                                          │
│ DIONYSUS         │                                          │
│   Metadata       │                                          │
│   Search         │                                          │
│   Assets         │                                          │
│ MINERVA          │                                          │
│ > Calendar       │                                          │
│   Documents      │                                          │
└──────────────────┴──────────────────────────────────────────┘
   suite-owned: a registry      console-owned: its own routes
```

- **Property and console in the sidebar**, from a registry compiled into
  every console image, rendered identically everywhere.
- **The console's pages in a header tab strip**, its own routes, client-side.
- **Nothing below that is chrome.** A calendar's events, a certificate's
  detail: content — a nested route, a drawer, a master/detail split.

The suite fits in one sidebar — three groups and nine consoles is about
twelve rows, with room to double — so there is nothing to hide behind a
property switcher, and anywhere in the suite is one click away. The control
that has to survive a cross-console page load is then also the control that
never changes: only the content area and the tab strip swap, so a full load
reads as navigation. Groups stay expanded (at this size an accordion buys
nothing and adds state to lose across a load), and there are no
breadcrumbs: the sidebar has the property and console, the tabs have the
page.

If the suite ever outgrows this — properties past five or six, or a console
with more pages than a tab strip holds — the nav model is data, so the
switch is a change inside the shell package and touches no console.

### The shell package

`packages/console` (`@ncfritz/olympus-console`) owns everything the suite
shares: the registry, the shell component, theme mode, the auth hook, and
the API client factory that sets `X-Olympus-Client`. Cross-console links
are plain anchors — they are leaving the app either way.

Two things vary per deployment, and they are resolved in different places:

- **The base path is baked**, from `NEXT_PUBLIC_BASE_PATH` at build time,
  because `basePath` is a build-time setting and the path a console is
  published under is part of the convention, not a host's choice.
- **Which consoles a host actually runs is not.** Each console's root
  layout is a server component and reads `CONTROL_CONSOLES` (and an
  optional `CONTROL_ORIGIN`) at runtime, so a host's menu is an env change
  and a restart, not a rebuild. Unset means the whole registry, which is
  what the workspace wants.

Because ADR 0019 builds and deploys every image at one git tag, the
registry can be static: consoles cannot drift apart.

### Where a console lives

- Belongs to an agent: `agents/<name>/console`, unchanged from ADR 0016.
- Has no agent of its own, or spans a property (deployment tools, the CA
  console): `apps/<name>-console`.
- The suite's index at `/` is `apps/control`, a small app on the same
  shell that lists the properties and their consoles.

### Sign-in

Until [authentication](0018-authentication.md) phase 3, each console signs
in against its own agent. The cookie's path becomes the console's base
path, so one console's session is not sent to the rest of the suite. After
phase 3 the API is the authorization server and the suite has one session
at the control root.

## Consequences

- `minerva.internal.ncfritz.net` goes, along with its certificate and DNS
  record; the OAuth redirect URIs registered with Google and Microsoft move
  to `https://control.olympus.ncfritz.net/minerva/calendar/api/auth/callback/<provider>`
  and must be re-registered before the cutover or sign-in breaks.
- Adding a console is a registry entry, a bake target, two nginx locations
  and one env entry — no new name, record or certificate.
- Navigation will not feel finished until authentication phase 3: crossing
  into a console you have not used today is a login bounce.
- The shell package makes the consoles a distributed frontend: a change to
  it rebuilds all of them. That is already how they deploy.
- It brings the first React tests into the repository (the site has none);
  the shell is where they start.
- ADR 0016 is unchanged — this record adds how a console is published and
  how it navigates, not what it is.

## Open

- Whether the index at `/` also carries service health, or stays a list.
- Whether `packages/ui` and `packages/theme` (ADR 0012, roadmap 7) absorb
  parts of the shell when the site is imported. The site is Pages Router
  on React 18; the consoles are App Router on React 19, so they stay apart
  until that is reconciled.
- Whether the registry ever becomes a document fetched at runtime. Only
  needed if consoles stop deploying together.

## Implementation

[docs/plans/console/README.md](../plans/console/README.md).
