# OnAir for iOS: phased implementation plan

An Expo app, `apps/onair-ios`, that reads and sets Minerva availability
([ADR 0029](../../decisions/0029-minerva-availability.md)) through the
existing API, signs in as the `olympus-ios` client
[ADR 0018](../../decisions/0018-authentication.md) already reserves, and
reaches the API from outside the LAN through the border with a device
certificate. Built on `feature/onair-ios`. Each phase ends in a build that
runs on a device and a sign-off against [signoff.md](signoff.md).

| Phase | Delivers                                                          | Depends on      |
| ----- | ----------------------------------------------------------------- | --------------- |
| 1     | Scaffold, sign-in, API client, loading screen                     | —               |
| 2     | Now, Schedule, Meeting status, Overrides, New override            | 1               |
| 3     | Home Screen and Lock Screen widgets (`expo-widgets`)              | 2               |
| 4     | Live Activity and Dynamic Island, pushed through APNs             | 2, the APNs ADR |
| 5     | Apple Watch app and complications (`expo-apple-targets`, Swift)   | 2               |
| 6     | Final icon, loading animation, device sign-off on and off the LAN | 3, 4, 5         |

Phases 3, 4 and 5 can run in any order. Sign-off away from home needs the
border ([authentication plan](../authentication/README.md), phase 6).

## Decisions

- **Built locally** with `npx expo run:ios` and Xcode. EAS Build and
  TestFlight are revisited once the app is further along (Neil, 2026-10-14).
- **Bundle ID** `net.ncfritz.olympus.onair`, beside the tester's
  `net.ncfritz.olympus.authtester` (Neil, 2026-10-14).
- **Scheme** `olympus`, so the sign-in redirect is `olympus://auth` as
  ADR 0018 draws it.

## Phase 1 — Foundation

1. Scaffold `apps/onair-ios`: Expo SDK 57, Expo Router (routes in `src/app`),
   placeholder screens, the ON AIR loading screen, the pure status and theme
   modules with unit tests and the boundary guard. **Done 2026-10-14.**
2. Sign-in through `packages/auth-flow` as `olympus-ios`; tokens in
   `expo-secure-store`; the root layout shows the loading screen while the
   Keychain is read and today loads, then the tabs or the sign-in screen
   (`Stack.Protected`). A refused refresh or a 401 signs out; an API it
   cannot reach keeps the session and offers Try again. `createSession`
   moved from the mobile tester into `auth-flow` so both apps share it.
   **Done 2026-10-14.**
3. API calls through `@ncfritz/olympus-client`'s new `AvailabilityApi`,
   types from `@ncfritz/olympus-sdk/minerva`. Now shows the current status
   as the proof. **Done 2026-10-14.**
4. The `client-identity` Swift module, moved from `tools/auth-tester-mobile`
   to a place both apps use, for the device certificate. Needed once the
   border is live; until then the app uses `olympus.internal.ncfritz.net`
   on the LAN.

## Phase 2 — Screens

The designs on the OnAir canvas: Now (lamp glow, countdown ring, day strip,
Up next with a left-border status), Schedule, Meeting status, Overrides, New
override. The status words and colours move from `apps/site/src/utils` and
`src/status.ts` to one shared package so the site and the app agree. Refresh
on open and every 30 seconds, as the site's drawer does.

1. `packages/availability` (`@ncfritz/olympus-availability`): the four
   OnAir words, their labels, and the mapping to and from Minerva's levels
   and calendar statuses. The site's `onair.ts` and `meetingAvailability.ts`
   and the app's `src/status.ts` use it. **Done 2026-10-14.**
2. `src/schedule.ts`, pure and unit-tested: the loaded window (a week back,
   two weeks ahead), what holds the status now and why (an override before a
   meeting), the day strip, Up next, timeline columns, overrides by day and
   the New override length chips. **Done 2026-10-14.**
3. The session refreshes every 30 seconds and when the app comes back to the
   foreground; a failed refresh keeps what is on screen and says it is out of
   date. It sets a meeting's level, and saves and deletes overrides, then
   reloads. **Done 2026-10-14.**
4. Screens: Now (glow header, countdown ring, ON AIR, Change and Override,
   day strip, Up next), Schedule (week strip, timeline from 7 AM, status
   rail, now line), Meeting status (follow calendar or DND, Interruptable,
   Free), Overrides (Upcoming and Past by day) and New override, which also
   edits and deletes an override as a modal. Adds `react-native-svg` and
   `@react-native-community/datetimepicker`, so the native build has to be
   made again. **Done 2026-10-14.**

## Phase 3 — Widgets

`expo-widgets`: small, medium, large and the three Lock Screen sizes. The app
writes a timeline of status changes from the 15-minute slots, so widgets
change on schedule without the app running. Quick Set buttons create
30-minute overrides (iOS 17+).

## Phase 4 — Live Activity

Needs an ADR first: APNs is the platform's first outside dependency.

1. A `device_push_token` table and operations (`pnpm gen api-operation`).
2. An `availability.changed` message, published by the API when a block or
   a meeting's status changes and when calendar sync changes a meeting.
3. An APNs channel in `olympus-notification` that schedules a push at each
   status change: start on air, update, end at Free or Clear. The `.p8` key
   is a secret, never committed.
4. The Lock Screen banner and Dynamic Island layouts.

## Phase 5 — Watch

`expo-apple-targets` watch and watch-widget targets in Swift: Now, Today,
Meeting status, Override, complications, Smart Stack. Open question: the
watch calls the API itself (its own device certificate) or the phone relays.

## Phase 6 — Polish and sign-off

The chosen icon in default, dark and tinted; the loading screen's animation;
[signoff.md](signoff.md) on a real iPhone and Watch, on the LAN and away.
