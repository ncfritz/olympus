# 0029. Availability per user in Minerva; the console signs in through Olympus

- **Status:** Accepted
- **Date:** 2026-10-04

## Context

Two systems work out whether Neil can be interrupted, and both belong to
no one:

- The calendar sync agent computes availability from every calendar it
  syncs, in 15-minute slots of `none`, `free`, `interruptable` or `busy`,
  with two kinds of override: a block of time with a status
  (`OverrideBlock`) and a status for one meeting (`EventOverride`). Only
  its console reads or sets them.
- The legacy OnAir service (`onair.sea.ncfritz.net`, on a Raspberry Pi)
  keeps its own events, a status per 15-minute slot (`clear`, `free`,
  `interrupt`, `dnd`) and its own overrides. The site's OnAir drawer reads
  and sets them there.

Since [ADR 0028](0028-minerva-calendar-ownership.md), meetings in Minerva
belong to users, and the site is where users manage their calendars. The
OnAir service is legacy: it will be rewritten in Go to read Minerva once
this lands (Neil, 2026-10-04). The console stays as an operator's view
(ADR 0028, amended), but signs in on its own, with its own allow-list.

## Decision

### Availability is the user's, in Minerva

- **Overrides move into Minerva, per user.** Two tables:
  - `minerva.availability_blocks`: `id`, `user_id`, `start_time`,
    `end_time`, `status`, `label`, audit columns. A block of time, whatever
    meetings fall in it.
  - `minerva.meeting_availability`: `user_id`, `meeting_id`, `status`,
    audit columns; one per meeting the user has set. Keyed by the meeting's
    ID with no key to `meetings`, as `meeting_notes` is, so it survives a
    meeting being re-synced, removed with its account and imported again.
- **The API works out availability** from the user's own meetings, the
  same way the agent does now:
  - A meeting's status from its free/busy status (`Busy` → `busy`,
    `Tentative` → `interruptable`, `Free` → `free`, `OOF` and
    `WorkingElsewhere` → `none`), unless the user set one for it.
  - Cancelled and deleted meetings, and those of calendars that do not
    count toward busy, do not count.
  - A slot takes the highest of what overlaps it (`none` < `free` <
    `interruptable` < `busy`); a block overlapping it wins over every
    meeting; nothing overlapping is `free`.
  - Outside the working day (by default 08:00 to 18:00 on weekdays, in the
    time zone the caller names) only overrides count; the rest is `none`.
- **One vocabulary in the API**, the agent's: `none`, `free`,
  `interruptable`, `busy`. OnAir's `clear`, `free`, `interrupt`, `dnd` are
  the same four levels; the site and the rewritten OnAir service show them
  in their own words.
- **Operations**, all scoped to the caller: `GetAvailability` (the
  timeline of a range, with each meeting's own and effective status and
  the blocks in it), `ListAvailabilityBlocks`,
  `CreateAvailabilityBlock`, `UpdateAvailabilityBlock`,
  `DeleteAvailabilityBlock`, `SetMeetingAvailability` and
  `ClearMeetingAvailability`.

### Where it is set: the drawer, as it is

- **The OnAir drawer keeps its UX** (Neil, 2026-10-04: it is reworked
  later, not now). Its day calendar, the 15-minute status shading, override
  blocks made by selecting a range and moved or resized by dragging, a
  meeting's status set from it, and its four buttons (Do Not Disturb,
  Interruptable, Free, Clear) stay as they are. Only its source changes:
  it reads and writes Minerva through the API instead of the OnAir service.
- **The header's ON AIR button** shows the user's current availability from
  the API the same way (active when busy or interruptable).
- The site maps the API's levels onto the drawer's words: `busy` is
  `dnd`, `interruptable` is `interrupt`, `free` is `free`, `none` is
  `clear`.
- Setting a meeting's availability from the calendar pages, and anywhere
  else meetings render, comes with that later rework.

### The agent's availability goes

- The agent's override tables and their operations are removed and their
  rows deleted (Neil, 2026-10-04), with its availability operations
  (`GetFreeBusy`, `GetStatusTimeline`), which only the console used.
- The agent keeps whether a calendar counts toward busy, which the API
  reads, as it does for the Calendars page.

### The console signs in through Olympus

- The console becomes a client of the Olympus API's sign-in
  (`minerva-calendar-console`, beside `olympus-site` and `olympus-ios`):
  with an Olympus session already open, signing in is one redirect.
- The agent accepts Olympus access tokens, checked with the API's
  published keys (`/.well-known/jwks.json`), and requires the `admin`
  role. Its own OIDC sign-in, `AUTH_OIDC_PROVIDERS` and
  `AUTH_ALLOWED_EMAILS` are retired.
- The console's availability views call the Olympus API with the same
  token, so it shows and sets the signed-in user's availability: one set,
  seen the same from the site and the console. The token is an httpOnly
  cookie on the console's origin, so the console calls through its agent,
  which presents it and forwards the availability operations alone. Its pages look as they do
  now; only their source changes. What else it shows (every
  account's events, sync runs, the outbox) stays the agent's.

## Consequences

- Availability is per user, like everything else in Minerva, and the
  agent knows nothing of users.
- One place sets overrides; the site, the console and later the OnAir
  service read the same.
- The OnAir drawer no longer reads the OnAir service. The Pi carries on
  with its own overrides until it is rewritten; overrides set in the
  drawer reach the sign only then. How the rewritten service calls the
  API (a service certificate naming the user, or a device sign-in) is
  decided with it.
- The overrides kept in the agent and in the OnAir service are not
  carried over.
- Working hours are request parameters for now; a per-user setting comes
  if more than the drawer needs them.
- The console needs the API reachable to sign in at all.
