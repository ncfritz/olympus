# @ncfritz/olympus-onair-ios

OnAir for iPhone: your Minerva availability (ADR 0029) at a glance, meeting
status, and overrides. Built in phases from
[the plan](../../docs/plans/onair-ios/README.md).

```sh
pnpm install                                                   # from the repo root
pnpm turbo run build --filter=@ncfritz/olympus-onair-ios^...   # the workspace packages it imports
pnpm --filter @ncfritz/olympus-onair-ios start                 # Metro
cd apps/onair-ios && npx expo run:ios                          # a development build
```

**Built locally with Xcode.** EAS Build and TestFlight wait until the app is
further along (`docs/conventions/mobile.md`: anything hosted is a decision).

|           |                                                             |
| --------- | ----------------------------------------------------------- |
| Bundle ID | `net.ncfritz.olympus.onair`                                 |
| Client ID | `olympus-ios` (`apps/api/src/auth/clients/clients.ts`)      |
| Scheme    | `olympus` (sign-in redirects to `olympus://auth`, ADR 0018) |
| Expo SDK  | 57, Expo Router with routes in `src/app`                    |

## Signing in

The app signs in as `olympus-ios` with PKCE in the system authentication
session, the flow `tools/auth-tester-mobile` proved, and keeps its tokens in
the Keychain. The session (`createSession` in `@ncfritz/olympus-auth-flow`)
rotates the access token as it expires.

It talks to `https://olympus.internal.ncfritz.net/api/v1` until the border is
live (authentication plan, phase 6), so for now it works on the home network
only. Point it elsewhere for a build with:

```sh
EXPO_PUBLIC_OLYMPUS_API_BASE_URL=http://192.168.1.10:3100/v1 npx expo run:ios
```

At launch it shows the ON AIR loading screen while it reads the Keychain and
loads today; then the tabs, or the sign-in screen. A refused refresh or a 401
signs out; an API it cannot reach keeps the session and offers Try again.

## Layout

| Path                                                | Holds                                               |
| --------------------------------------------------- | --------------------------------------------------- |
| `src/app/(tabs)`                                    | Now, Schedule, Overrides                            |
| `src/app/sign-in.tsx`                               | Signed out                                          |
| `src/app/meeting/[meetingId].tsx`                   | Meeting status                                      |
| `src/app/override/new.tsx`                          | New override (modal)                                |
| `src/app/loading.tsx`                               | A development preview of the loading screen         |
| `src/auth`                                          | Sign-in, the Keychain, the session and its provider |
| `src/components`                                    | `LoadingScreen`, `PillButton`, `Placeholder`        |
| `src/config.ts`, `status.ts`, `theme.ts`, `time.ts` | Pure, unit-tested, guarded by `boundary.spec.ts`    |

Schedule, Overrides and the two pushed screens are placeholders until
phase 2; Now shows the current status, which proves the sign-in and the API.
Native tabs are `expo-router/unstable-native-tabs` on SDK 57, so the tab bar
is Expo Router's JavaScript `Tabs` for now.

## Adding things

`npx expo install <package>`, never `pnpm add`: it picks the version SDK 57
expects. Run `npx expo-doctor` after adding anything native.
