# @ncfritz/olympus-availability

Minerva availability ([ADR 0029](../../docs/decisions/0029-minerva-availability.md))
in OnAir's words, for the site and the iPhone app (`apps/onair-ios`) alike.

| Export                     | For                                                            |
| -------------------------- | -------------------------------------------------------------- |
| `Level`                    | the API's `AvailabilityLevel`: none, free, interruptable, busy |
| `OnAirStatus`              | OnAir's words for them: clear, free, interrupt, dnd            |
| `toOnAirStatus`, `toLevel` | one to the other                                               |
| `STATUSES`, `LABELS`       | the pickers' order and names                                   |
| `isOnAir`                  | whether the light is on                                        |
| `levelOfCalendarStatus`    | a meeting's level from its calendar status, as the API does    |

Colours are not here: the site and the app are styled differently, and each
keeps its own.
