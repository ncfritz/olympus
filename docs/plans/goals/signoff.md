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
5. `user-b` deletes all six starter categories; listing again gives none
   back.
6. `infra/hasura/tests/minerva_goal_categories_cycles.sql` passes against
   `hasura-dev`'s database.

## G3 — Goals of each type

1. One goal of each type created with its rule, milestones and tags;
   each describes back as entered.
2. An outcome goal without a target, a habit without a rule, and a goal
   due before it starts are each refused before Hasura.
3. A milestone ticked moves the goal's progress by its weight.
4. Pause, resume, delete, restore: lists follow; a goal with sub-goals
   cannot be deleted.
5. A goal's type cannot be changed; closing it as missed needs a date,
   and reopening it clears the date.
6. Deleting a category that holds goals is refused, and with
   `moveTo` the goals move to the named category.
7. Deleting a cycle leaves its goals as custom-horizon goals on the same
   dates.
8. A tag's `goalCount` counts the live goals that carry it.
9. `infra/hasura/tests/minerva_goals.sql` passes against `hasura-dev`'s
   database.

## G4 — Sub-goals and rollup

1. A three-level tree (year → cycle → milestone and habit) rolls up by
   average, then by weight; `sum` is accepted only on an outcome goal and
   adds the sub-goals that share its unit.
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
5. The suggestion's confidence follows the numbers even after a
   check-in said otherwise; the goal's health follows the check-in until
   its progress moves.

## G6 — Habits

1. Logging a run today, then again, leaves one log; a quantity habit
   records its value.
2. Today's habits lists only habits due today by their rule.
3. With `tz-utc` at 18:00 Pacific, today is the UTC day, not the Pacific
   one; the same request with the Pacific header is the Pacific day.
4. Adherence and streaks on the habit panel match a count by hand over
   twelve weeks.
5. A weekdays habit is not on the strip on its days off; a weekly habit
   leaves the strip once the week's count is met, unless logged that day.

## G7 — Execution and close-out

1. This week's execution equals habit occurrences done over due, by hand.
2. Closing a goal as Missed with a note shows the close-out on its page
   and removes it from active lists; Achieved and Dropped likewise.
3. Closing an outcome with a final value adds that check-in; closing a
   goal again is refused, and setting a closed status through UpdateGoal
   is refused; reopening it through UpdateGoal clears its closing date.
4. `infra/hasura/tests/minerva_goal_checkins_habits.sql` passes against
   `hasura-dev`'s database.

## G8 — The site

1. Board, Roadmap and Focus show the same goals with the same health and
   progress as the API.
2. The new goal form adapts to each type and creates what the API
   accepted in G3.
3. The check-in form from the goal page and from a Focus row both save,
   and the history shows the source.
4. Every icon-only button has an accessible name; health is shown with
   words or an icon, not colour alone.
5. A tree four levels deep shows three on the Board, and "more below"
   shows the fourth.
6. Focus lists a goal needing a decision first; Replan, Push due date and
   Drop each do what they say.
7. Today's habits tick off from Focus and from a habit's page, and the
   week's bars and execution follow.
8. Categories reorder, recolour, archive and delete (moving their goals)
   from the drawer; a tag typed in the goal form is created.
9. The goal page's panel matches each type, and closing, reopening,
   deleting and restoring work from its menu.

## G9 — Notes on goals

1. New note on a goal page saves a note that lists under Notes on that
   goal, newest first, and not on other goals.
2. Editing, flagging, deleting and restoring a note there behave as on
   the Notes page.
3. On the Notes page the note's associations name the goal and link to
   it.

## G10 — Minerva Home

1. The Habits tab lists today's habits as Focus does; logging one there
   shows on the goal page, and a tap on a done habit undoes it.
2. The other tabs list the cycle's goals of their type in Focus's order;
   Quarter lists this quarter's. Done ticks the next milestone and Check
   in saves a check-in; either marks the goal done today.
3. With no cycle running the section shows the quarter and Plan a cycle.

## G11 — The reviews

1. Habits logged in the daily review show on their goals.
2. The weekly review's Reflect check-ins are pre-filled from the week,
   saved with source `weekly_review`, and appear in each goal's history.

## G12 — Tasks

1. A task linked to two goals counts toward both execution scores.
2. A milestone ticks itself when its last linked task is done, and
   unticks when one is reopened.

## G13 — Habits driven by repeats

Tasks' sign-off T16, run from the goal page: a `repeat` habit's
adherence, streak and check-in panel read the task series, and the
execution score counts its done occurrences as it counts habit logs.
