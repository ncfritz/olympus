# @ncfritz/olympus-onair-ios

OnAir for iPhone: your Minerva availability (ADR 0029) at a glance, meeting
status, and overrides. Built in phases from
[the plan](../../docs/plans/onair-ios/README.md); this is phase 1's scaffold.

```sh
pnpm install                                           # from the repo root
pnpm --filter @ncfritz/olympus-onair-ios start         # Metro
cd apps/onair-ios && npx expo run:ios                  # a development build
```

**Built locally with Xcode.** EAS Build and TestFlight wait until the app is
further along (`docs/conventions/mobile.md`: anything hosted is a decision).

|           |                                                             |
| --------- | ----------------------------------------------------------- |
| Bundle ID | `net.ncfritz.olympus.onair`                                 |
| Scheme    | `olympus` (sign-in redirects to `olympus://auth`, ADR 0018) |
| Expo SDK  | 57, Expo Router with routes in `src/app`                    |

## Layout

| Path                              | Holds                                       |
| --------------------------------- | ------------------------------------------- |
| `src/app/(tabs)`                  | Now, Schedule, Overrides                    |
| `src/app/meeting/[meetingId].tsx` | Meeting status                              |
| `src/app/override/new.tsx`        | New override (modal)                        |
| `src/app/loading.tsx`             | A development preview of the loading screen |
| `src/components`                  | `LoadingScreen`, `Placeholder`              |
| `src/status.ts`, `src/theme.ts`   | Status words and colours; pure, unit-tested |

The screens are placeholders until phase 2. Native tabs are
`expo-router/unstable-native-tabs` on SDK 57, so the tab bar is Expo
Router's JavaScript `Tabs` for now.

## Adding things

`npx expo install <package>`, never `pnpm add`: it picks the version SDK 57
expects. Run `npx expo-doctor` after adding anything native.
