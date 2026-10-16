# OnAir for iOS: functional sign-off

Device checks for each phase of the [plan](README.md). Unit tests cover the
pure modules; these prove the app on a real iPhone (and Watch). Cases are
added as each phase lands.

| Id    | Phase | Env | Steps                                                                          | Expected                                                                    |
| ----- | ----- | --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| O1.1  | 1     | DEV | `npx expo run:ios` on a simulator and on a device                              | The app opens on Now with three tabs: Now, Schedule, Overrides              |
| O1.2  | 1     | DEV | From Now, open Meeting status, New override, the preview                       | Meeting pushes with a back button; New override is a modal                  |
| O1.3  | 1     | DEV | Open the loading screen preview                                                | ON AIR sign tilted, ends past both edges, no corners on screen              |
| O1.4  | 1     | INT | Fresh install on the LAN; sign in with Google                                  | Loading screen, then Now with the current status and today's counts         |
| O1.5  | 1     | INT | Quit and reopen                                                                | No sign-in prompt; straight to Now after the loading screen                 |
| O1.6  | 1     | INT | Sign out, then turn Wi-Fi off and reopen                                       | Sign-in screen; with Wi-Fi off a signed-in launch offers Try again          |
| O1.7  | 1     | INT | Revoke the session from the site, then Refresh on Now                          | Back to sign-in with "Your session ended"                                   |
| O2.1  | 2     | INT | Open Now during a meeting, then between meetings                               | Ring counts down to the meeting's end; between them it shows Clear          |
| O2.2  | 2     | INT | Tap Change on Now during a meeting; pick Free; Save                            | Meeting status opens; back on Now the lamp is green within a refresh        |
| O2.3  | 2     | INT | On Meeting status pick Remove my setting                                       | The meeting follows its calendar status again                               |
| O2.4  | 2     | INT | Override, 30m, DND; then edit it from Overrides and Delete                     | Now goes red at once; the edit saves; Delete removes it everywhere          |
| O2.5  | 2     | INT | New override with a custom start and end and a label                           | It appears on Schedule and under Overrides on its day with the label        |
| O2.6  | 2     | INT | Schedule: change day, next and previous week, tap an event                     | Timeline opens at 7 AM; chevrons stop at the loaded weeks; tap opens        |
| O2.7  | 2     | INT | Set an override on the site; wait 30 seconds on Now                            | The app shows it without a manual refresh                                   |
| O2.8  | 2     | INT | With Now open, turn Wi-Fi off for a minute                                     | The screen keeps its data and says it is out of date                        |
| O2.9  | 2     | INT | Schedule on a day with all-day events; scroll to the top                       | A row says how many above 12 AM, which is not cut off; none on the timeline |
| O2.10 | 2     | INT | Pull down on that row, then scroll down past the list                          | Pulling shows the list; scrolling away folds it; the timeline stays put     |
| O2.11 | 2     | INT | Pull down with the list open, and on a day without any                         | The hint says Release to refresh, then Refreshing… until it reloads         |
| O2.12 | 2     | INT | Pull down on Now and on Overrides                                              | A hint below the Dynamic Island: Pull, Release, then Refreshing…            |
| O2.13 | 2     | INT | Pull to refresh on any tab and let go                                          | The hint stays open with the spinner for at least 0.6 s, then closes        |
| O2.14 | 2     | DEV | Look at the tab bar; tap + from each tab                                       | Icons on Now, Schedule, Overrides, Settings; + opens New override           |
| O2.15 | 2     | INT | Open Settings; Sign out                                                        | API host, connection, last update, version; Sign out goes to sign-in        |
| O2.16 | 2     | INT | Settings: set 9:00 to 5:00, then an end before the start                       | Strip reads 9a–5p; the reversed hours are refused and not saved             |
| O2.17 | 2     | INT | Open Now after working hours with no override                                  | No countdown: Off hours, Clear, until tomorrow (or Monday) at the start     |
| O2.18 | 2     | INT | Set an override after hours, then turn Weekends free off on a Saturday         | The override counts down; Saturday becomes a working day                    |
| O2.19 | 2     | DEV | Open a meeting; go back with the chevron, then with a swipe from the left edge | A bare < with no label or capsule; both go back to the list                 |

Environments are the authentication sign-off's: DEV, INT (the LAN), EXT
(outside it).
