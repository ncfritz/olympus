# Goals: functional sign-off

One test plan per flow of [ADR 0026](../../decisions/0026-minerva-goals.md)
and the [design](design.md), used to sign off each phase of the
[plan](README.md). Automated tests cover the rules; these checks prove the
flows on the real pieces: Hasura, the API, the site.

## Environments

| Id       | Where                                                    | Used from |
| -------- | -------------------------------------------------------- | --------- |
| **DEV**  | the API and site from the workspace against `hasura-dev` | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack                           | phase 5   |

## Fixtures

| Fixture  | What                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------- |
| `user-a` | a signed-in user with the starter categories, a cycle starting 2026-09-07, and the canvas's sample goals |
| `user-b` | a second signed-in user with nothing                                                                     |
| `tz-utc` | requests sent with `x-ncfritz-tz: Etc/UTC` instead of `America/Los_Angeles`                              |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

## G1 — Tags

1. `user-a` creates `olympus`; creating `Olympus` again is refused.
2. Renaming a tag shows on every goal it is on; deleting it removes it
   from them.
3. `user-b` lists no tags and gets 404 for `user-a`'s tag ids.
4. A colour set on a tag is returned lowercase; setting it to null
   removes it.
5. `infra/hasura/tests/minerva_tags.sql` passes against `hasura-dev`'s
   database.

## G2 — Categories and cycles

1. `user-b`'s first category list holds the six starter categories, once.
2. A vision statement saved on Health shows on the board card.
3. Reorder and archive: the board follows; an archived category's goals
   keep it and it leaves the pickers.
4. A cycle starting on a Tuesday is refused; one overlapping another is
   refused; today's week in Cycle 4 is 4 of 12 on 2026-10-01.

## G3 — Goals of each type

1. One goal of each type created with its rule, milestones and tags;
   each describes back as entered.
2. An outcome goal without a target, a habit without a rule, and a goal
   due before it starts are each refused before Hasura.
3. A milestone ticked moves the goal's progress by its weight.
4. Pause, resume, delete, restore: lists follow; a goal with sub-goals
   cannot be deleted.

## G4 — Sub-goals and rollup

1. A three-level tree (year → cycle → milestone and habit) rolls up by
   average, then by weight; `sum` is offered only when the children share
   a unit.
2. Moving a goal under its own sub-goal is refused.
3. The UI shows three levels and expands past them.

## G5 — Check-ins and pace

1. An outcome check-in moves current progress; the suggestion matches
   pace (on track inside the band, at risk below it).
2. Overriding the suggested confidence sticks.
3. Three check-ins running at risk or worse flag the goal; a fourth on
   track clears it.
4. A check-in dated tomorrow is refused; one backfilled to last month
   lands in order in the history and the chart.

## G6 — Habits

1. Logging a run today, then again, leaves one log; a quantity habit
   records its value.
2. Today's habits lists only habits due today by their rule.
3. With `tz-utc` at 18:00 Pacific, today is the UTC day, not the Pacific
   one; the same request with the Pacific header is the Pacific day.
4. Adherence and streaks on the habit panel match a count by hand over
   twelve weeks.

## G7 — Execution and close-out

1. This week's execution equals habit occurrences done over due, by hand.
2. Closing a goal as Missed with a note shows the close-out on its page
   and removes it from active lists; Achieved and Dropped likewise.

## G8 — The site

1. Board, Roadmap and Focus show the same goals with the same health and
   progress as the API.
2. The new goal form adapts to each type and creates what the API
   accepted in G3.
3. The check-in form from the goal page and from a Focus row both save,
   and the history shows the source.
4. Every icon-only button has an accessible name; health is shown with
   words or an icon, not colour alone.

## G9 — Notes on goals

1. Linking an existing note and creating a new one from the goal page both
   list under Linked notes, and the note shows the goal among its
   associations.

## G10 — Minerva Home

1. The goals strip and today's habits match the Goals home; logging a
   habit there shows on the goal page.

## G11 — The reviews

1. Habits logged in the daily review show on their goals.
2. The weekly review's Reflect check-ins are pre-filled from the week,
   saved with source `weekly_review`, and appear in each goal's history.

## G12 — Tasks

1. A task linked to two goals counts toward both execution scores.
2. A milestone ticks itself when its last linked task is done, and
   unticks when one is reopened.
