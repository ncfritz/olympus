# OnAir for iOS: functional sign-off

Device checks for each phase of the [plan](README.md). Unit tests cover the
pure modules; these prove the app on a real iPhone (and Watch). Cases are
added as each phase lands.

| Id   | Phase | Env | Steps                                                    | Expected                                                       |
| ---- | ----- | --- | -------------------------------------------------------- | -------------------------------------------------------------- |
| O1.1 | 1     | DEV | `npx expo run:ios` on a simulator and on a device        | The app opens on Now with three tabs: Now, Schedule, Overrides |
| O1.2 | 1     | DEV | From Now, open Meeting status, New override, the preview | Meeting pushes with a back button; New override is a modal     |
| O1.3 | 1     | DEV | Open the loading screen preview                          | ON AIR sign tilted, ends past both edges, no corners on screen |

Environments are the authentication sign-off's: DEV, INT (the LAN), EXT
(outside it).
