# Tasks: functional sign-off

One test plan per flow of [ADR 0033](../../decisions/0033-minerva-tasks.md),
used to sign off each phase of the [plan](README.md). Automated tests
cover the rules; these checks prove the flows on the real pieces: Hasura,
the API, the site.

## Environments

| Id       | Where                                                    | Used from |
| -------- | -------------------------------------------------------- | --------- |
| **DEV**  | the API and site from the workspace against `hasura-dev` | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack                           | phase 1   |

## Fixtures

| Fixture  | What                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user-a` | a signed-in user with the presets, a `MIN` project (Software scheme from phase 4) with components Goals and Tasks, a `HOME` Chores project (Checklist), and the canvas's sample tasks |
| `user-b` | a second signed-in user with nothing                                                                                                                                                  |
| `tz-utc` | requests sent with `x-ncfritz-tz: Etc/UTC` instead of `America/Los_Angeles`                                                                                                           |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

## T1 — Structure

1. `user-a`'s first read seeds the presets, the Inbox and the starter
   categories once; a second read seeds nothing more.
2. Folders nest and reorder; moving a folder into its own descendant is
   refused.
3. A project key that is not 2–6 capitals, or repeats one of the user's,
   is refused.
4. A component from another project cannot be set on a task.
5. `user-b` lists nothing and gets 404 for `user-a`'s folder, project and
   task ids and keys.
6. `infra/hasura/tests/minerva_tasks.sql` passes against `hasura-dev`'s
   database, including the status-in-workflow trigger.

## T2 — Tasks and status

1. Tasks in `MIN` get `MIN-1`, `MIN-2`…; a deleted and restored task keeps
   its key.
2. Moving `MIN-2` to `HOME` gives it a `HOME` key; `GET /task/key/MIN-2`
   still finds it.
3. `ChangeTaskStatus` to a status outside the task's workflow is refused;
   to done stamps `closed_at` and records the change; back to to do
   clears it.
4. Checklist lines tick, reorder and promote to a task in the same
   project, linked back.

## T3 — Capture

1. Quick add "Order filters fri #house !high" lands in the Inbox with the
   tag and priority, and the date from phase 2.
2. Naming a project (`^MIN`) files the task there.
3. Triage from the Inbox moves a task to a project and component in one
   step.

## T4 — Dates and availability

1. A task deferred to tomorrow is _Deferred_ today and _Available_
   tomorrow, with no write between.
2. A project on hold makes its tasks _Inactive_; making it active
   restores them.
3. `MIN-5` blocked by `MIN-4` is _Blocked_ until `MIN-4` closes; a cycle
   of blocks is refused.
4. In a sequential milestone only the first open task is available.
5. A milestone's deadline flows to its tasks without one, and a task's
   earlier deadline wins.
6. With `tz-utc` late in the Pacific evening, "today" follows the header.

## T5 — Today, rolls and ladders

1. A task planned yesterday and not done shows in Today as rolled 1 day;
   re-planning it counts a re-plan.
2. Today orders a deadline tomorrow first, then the task that blocks
   three others, then a due-today task.
3. The due and deadline ladders show the levels in the feature set at 8,
   5, 1, 0 and −2 days.
4. Moving a deadline without a reason is refused.
5. Entering Waiting asks for _waiting on_ and a follow-up date; the task
   shows in Waiting and returns to Today on that date.

## T6 — Calendar

1. Dragging a task onto Thursday 10:00–11:00 sets its planned day and
   block; resizing and moving update it; dragging off unplans it.
2. Deadlines show in the all-day row; the day's load sums estimates.
3. Nothing is written to any calendar account.

## T7 — Workflows and gates

1. Copying Build, adding "Blocked on hardware" (waiting) and saving
   works; a workflow with no done status, or two starts, is refused.
2. In Build, To do → Testing is refused; Testing → In progress is
   allowed.
3. A hard gate refuses with its message; a soft gate asks for a reason
   and records it.
4. Removing a status in use asks where its tasks go and moves them.

## T8 — Schemes and epics

1. In the Software scheme a bug cannot be put in an epic; a story can.
2. An epic cannot be closed while it has open tasks.
3. Converting `MIN-7` to an epic keeps its key, notes and links;
   splitting it creates tasks linked _split from_.
4. Changing a project's scheme maps every status by category, or by the
   mapping given.

## T9 — Boards

1. A project board's columns are its workflow's statuses; an illegal drop
   is not offered.
2. A board across `MIN` and `HOME` uses category columns; choosing a
   mapping prompts for statuses with no column.

## T10 — Goals

1. Linking `MIN-4` to a goal's milestone ticks the milestone when its
   linked tasks close.
2. A goal in `tasks` mode moves with its linked tasks; an epic linked to
   a goal counts all its tasks in the execution score.
3. Goals' G12 passes.

## T11 — Links and embeds

1. A task linked to a meeting, a note and a mail thread shows in each
   one's Linked tasks panel; unlinking removes it.
2. An unknown `item_type` is refused.
3. Typing `MIN-4` in a note shows a live chip; ticking it closes the task.
4. "Make a task" on a mail thread creates a linked Inbox task titled from
   the subject.
5. "Track as task" on a review item links them; closing the task closes
   the item.

## T12 — Repeats

1. Each model, run across four weeks with the scheduler on: Fixed and
   After completion keep one open occurrence; Mark missed closes the
   left-behind one as Missed; Aggregate shows "3 behind"; Stack keeps
   every one open; Window makes none outside its months.
2. Skip, move one occurrence, pause and end-after-N behave as stated.
3. Turning the scheduler off and on again catches up in one run without
   duplicates.
4. Quota, 3 a week: marking twice leaves "2 of 3"; the week ending
   closes it as Missed with 2; marking three times closes it done.
5. Track only: a left-behind occurrence closes as Missed when the next
   arrives and never shows overdue, red, in Keeps rolling or in a review
   attention list.
6. A reminder at 08:00 arrives once through the notification agent for
   an open occurrence, and not at all for one already done.

## T16 — Habits driven by repeats

1. "Make a habit goal" on HOME-9 (every 2 weeks, track only) creates a
   habit goal whose adherence and streak match the series' history.
2. Ticking HOME-9 in Today counts on the goal page; logging on the goal
   page closes the open occurrence. Neither writes a habit log.
3. "Remind me with a task" on a logs-mode habit creates a repeating task
   in the matching project with the same schedule; the goal's earlier
   logs still count for the days before.
4. Unlinking leaves the goal in logs mode with the schedule as a habit
   rule, and the task series with its history.
5. Deleting the series returns the goal to logs mode.

## T13 — Signals and reviews

1. Each signal fires at its threshold and clears when acted on; changing
   a threshold changes the result on the next read.
2. The daily review's Look back lists Keeps rolling and Follow up with
   their actions; Plan tomorrow blocks a task onto tomorrow.
3. The weekly review walks Projects to review one at a time and marks
   each reviewed.

## T14 — Views

1. `due < +7d & category = Software & !blocked` lists what it says;
   saving it makes a view in the sider.
2. A filter with an error shows where it fails and runs nothing.
3. A view embedded on Minerva Home lists the same tasks.

## T15 — Focus

1. Switching to Work hides Personal categories' projects and tasks, the
   matching goals and their review panels; All shows everything.
2. Goals' hide-empty setting hides categories with no goals.
