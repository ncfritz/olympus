# Tasks: phased implementation plan

The implementation of [ADR 0033](../../decisions/0033-minerva-tasks.md)
and the
[Minerva Tasks core feature set](https://claude.ai/code/artifact/6785948c-e2bb-450e-ad56-5bb02859aca6).
The screens are drawn on a design canvas in phase 0 and written up in
`design.md` before any site code. Each phase ends in a working,
deployable state and a functional sign-off against
[signoff.md](signoff.md).

| Phase | Delivers                                                                                                                       | Depends on     | Sign-off flows |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------- |
| 0     | ADR accepted; design canvas and `design.md`; empty feature in the model, API and site; the Tasks route                         | —              | —              |
| 1     | Foundation: categories, folders, projects, components, tasks, Inbox, quick add, checklists, keys                               | 0              | T1–T3          |
| 2     | Dates and availability: four dates, estimates, priority, milestones, dependencies, Today/Upcoming/Waiting                      | 1              | T4, T5         |
| 3     | Calendar: time blocks, the tasks layer, deadlines, daily load                                                                  | 2              | T6             |
| 4     | Workflows and types: presets, editors, gates, schemes, epics, convert and split, the board                                     | 1              | T7–T9          |
| 5     | Links: goals, generic links, Linked tasks panel, note chips, mail-to-task, Track as task                                       | 1; Goals       | T10, T11       |
| 6     | Repeats: seven models, track only, reminders, the scheduler, habit goals driven by repeats                                     | 2; Goals       | T12, T16       |
| 7     | Signals and reviews: thresholds, review panels, project reviews                                                                | 2; the reviews | T13            |
| 8     | Views and focus: the filter language, saved views, embedded lists, focus modes                                                 | 2              | T14, T15       |
| Later | iOS; sharing and assignees; automation on transitions; OnAir for time blocks; reminders; templates; tasks opened by other apps |                |                |

Phases 3 and 4 are independent of each other, as are 5 and 6. Goals'
phase 9 runs inside phase 5 here.

## Where the code goes

| What         | Where                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model shapes | `packages/model/src/minerva/tasks/`: `categories.ts`, `folders.ts`, `projects.ts`, `workflows.ts`, `schemes.ts`, `tasks.ts`, `repeats.ts`, `views.ts`, `index.ts`                        |
| API          | `apps/api/src/minerva/tasks/`: `TasksModule`, `controllers/`, `services/`, `converters/`, `queries/`, `engine/` (pure functions), `filter/` (the language), `seed/` (presets)            |
| Schema       | `infra/hasura/migrations/olympus/<ts>_minerva_tasks_*` (from `1791400000000`), with metadata (custom camelCase column names, as every table) and `infra/hasura/tests/minerva_tasks*.sql` |
| Site         | `apps/site/src/pages/minerva/tasks/`, `src/components/minerva/tasks/`, `src/api/tasksApi.ts`; the existing Tasks entry in `components/minerva/layout/menu.tsx`                           |

The operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Controllers are thin; services own the Hasura
documents; `engine/` owns every rule about effective dates, availability,
urgency, signals, rolls, epic progress, gates and repeats and does no
I/O. Every operation is `@RequiresIdentity()`, takes the caller with
`requireUser(principal)` and scopes every query by `user.userId`.

Every table has the audit columns as in ADR 0026: `created_at`,
`updated_at`, the `set_minerva_<table>_updated_at` trigger and the custom
names `createdTime` and `lastUpdatedTime`. Each migration test checks
that an update moves `updated_at` and leaves `created_at`, and that the
down migration leaves nothing behind.

Configuration: one flag, `TASKS_SCHEDULER_ENABLED`, arrives in phase 6;
it also turns on repeat reminders, which use the notification agent's
existing RabbitMQ connection settings.

## Phase 0 — Decision, design and scaffolding

1. **ADR 0033 accepted.**
2. **Design canvas**: Tasks home with the tree sider, Inbox, project list
   (grouped by component, epic, milestone), task drawer, quick add,
   Today, Upcoming, Waiting, calendar layer, board (single and mixed),
   workflow editor, scheme editor, repeat editor, Linked tasks panel,
   review panels, saved views and the focus switch. Written up as
   `docs/plans/tasks/design.md`, linking the canvas.
3. **Model**: `minerva/tasks/index.ts`, exported up to `src/index.ts`; no
   shapes yet.
4. **API**: `TasksModule` in `MINERVA_MODULES`, no operations.
5. **Site**: the menu's existing Tasks entry opens an empty
   `pages/minerva/tasks/index.tsx` behind sign-in.

**Sign-off:** the API boots, the menu entry opens the page, and the
Turbo tasks pass.

## Phase 1 — Foundation

1. **Migration** `1791400000000_minerva_tasks_foundation`:
   - `task_user_settings`: `user_id` (pk), `inbox_project_id`,
     `presets_seeded_at`, the signal thresholds (used from phase 7, with
     their defaults now), `active_focus_id` (from phase 8).
   - `task_categories`: `name` (1–50, unique per user case-insensitively),
     `color`, `icon`, `goal_category_id` (optional, set null), `position`,
     `archived`.
   - `task_folders`: `parent_id` (self, restrict, never itself, no cycle —
     checked by the service), `name`, `category_id`, `position`,
     `archived`, `deleted_at`.
   - `task_workflows`, `task_workflow_statuses` (`category` in the six,
     `name`, `color`, `position`, `is_start`, `is_system` for Missed),
     `task_workflow_moves` (`from_status_id`, `to_status_id`),
     `task_workflow_gates` (table only; used from phase 4). `CHECK`s and a
     deferred constraint trigger: exactly one start status, in backlog or
     todo; at least one done status; one Missed.
   - `task_schemes`, `task_scheme_types` (`name`, `icon`, `is_container`,
     `workflow_id`), `task_scheme_parents` (`leaf_type_id`,
     `container_type_id`).
   - `task_projects`: `folder_id` (optional), `key` (`^[A-Z]{2,6}$`,
     unique per user), `next_number`, `name`, `description`, `scheme_id`,
     `kind` (`parallel`, `sequential`), `status` (`active`, `on_hold`,
     `someday`, `completed`, `dropped`), `category_id`,
     `review_interval_days`, `last_reviewed_on`, `is_inbox`, `position`,
     `closed_at`, `deleted_at`. One Inbox per user (partial unique index).
   - `task_components`: `project_id`, `name`, `description`, `position`,
     `archived`.
   - `tasks`: `project_id`, `component_id` (same project, by composite
     key), `parent_id` (an epic in the same project), `type_id`, `number`
     (unique per project), `status_id`, `title` (1–200), `description`
     (at most 20 000), `position`, `started_at`, `closed_at`,
     `assignee_id` (null), `deleted_at`. The trigger keeps `status_id`
     inside the workflow of the task's type and `type_id` inside the
     project's scheme. `closed_at` exactly when the status's category is
     done or canceled.
   - `task_checklist_items`: `task_id`, `text` (1–200), `done_at`,
     `position`.
   - `task_status_changes`: `task_id`, `from_status_id`, `to_status_id`,
     `reason`, `changed_at`.
   - `task_key_aliases`: `task_id`, `key` (unique per user).
   - `task_tags`: `task_id`, `tag_id`, on the shared `minerva.tags`.
2. **Seeding** in `seed/`: on a user's first read, the Checklist and
   Standard workflows, the Checklist and Standard schemes (one leaf type,
   Task), the Inbox project (`INB`), and starter categories (Software,
   House, Hobbies, Admin), recorded in `presets_seeded_at`, once.
3. **Engine**: `keys.ts` (next key, alias on move), `moves.ts` (legal
   moves, any to any when none are listed), `hierarchy.ts` (scheme rules:
   container holds leaves only, one level, allowed parents), `quickAdd.ts`
   (parse "Order filters fri #house !high @Chores ^MIN" into title,
   project, tags, priority and dates; dates arrive in phase 2 but the
   parser takes them now).
4. **Operations**, tag `Tasks`:

   | Operation                   | Route                                                                                                                           |
   | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
   | `ListTaskCategories`        | `GET /task-categories`                                                                                                          |
   | `CreateTaskCategory` …      | `POST /task-categories`, `PUT`/`DELETE /task-category/:id`, `PUT /task-categories/order`                                        |
   | `ListTaskTree`              | `GET /task-tree` (folders and projects, with counts)                                                                            |
   | `CreateTaskFolder` …        | `POST /task-folders`, `PUT`/`DELETE /task-folder/:id`, `POST /task-folder/:id/restore`                                          |
   | `CreateTaskProject` …       | `POST /task-projects`, `GET`/`PUT`/`DELETE /task-project/:id`, `POST …/restore`                                                 |
   | `CreateTaskComponent` …     | `POST /task-project/:id/components`, `PUT`/`DELETE …/component/:componentId`, `PUT …/components/order`                          |
   | `ListTasks`                 | `GET /tasks` (project, component, status category, tag, text)                                                                   |
   | `CreateTask`                | `POST /tasks`                                                                                                                   |
   | `ParseTaskInput`            | `POST /tasks/parse` (quick add, for the site and later iOS)                                                                     |
   | `DescribeTask`              | `GET /task/:taskId` (also by key: `GET /task/key/:key`)                                                                         |
   | `UpdateTask`                | `PUT /task/:taskId`                                                                                                             |
   | `MoveTask`                  | `POST /task/:taskId/move` (project, component, position)                                                                        |
   | `ChangeTaskStatus`          | `POST /task/:taskId/status` (status, reason)                                                                                    |
   | `DeleteTask`, `RestoreTask` | `DELETE /task/:taskId`, `POST /task/:taskId/restore`                                                                            |
   | Checklist                   | `POST /task/:taskId/checklist`, `PUT`/`DELETE …/checklist/:itemId`, `PUT …/checklist/order`, `POST …/checklist/:itemId/promote` |

5. **Site**: Tasks home with the folder and project tree in the sider
   (drag to reorder and nest folders), Inbox with a triage action, the
   project page as a list grouped by component, the task drawer (status
   menu with legal moves only, fields, checklist, tags, history), and
   quick add on a global shortcut. AntD throughout.

**Sign-off:** T1–T3.

## Phase 2 — Dates and availability

1. **Migration** `1791410000000_minerva_tasks_dates`:
   - On `tasks`: `defer_on`, `defer_time`, `planned_on`, `planned_start`,
     `planned_end`, `first_planned_on`, `replan_count`, `due_on`,
     `due_time`, `deadline_on`, `deadline_time`, `estimate_minutes`,
     `priority` (`none`, `low`, `medium`, `high`, `urgent`), `flagged`,
     `waiting_on`, `follow_up_on`, `milestone_id`. `CHECK`s: a time only
     with its date; a planned block only with a planned day, start before
     end; `first_planned_on` set with the first `planned_on`.
   - On `task_projects`: `defer_on`, `due_on`, `deadline_on`, and times.
   - `task_milestones`: `project_id`, `name`, `due_on`, `deadline_on`,
     `sequential`, `position`, `closed_at`.
   - `task_dependencies`: `task_id`, `blocked_by_id` (same user, never
     itself; cycles refused by the service).
   - `task_relations`: `task_id`, `related_id`, `kind` (`related`,
     `split_from`, `duplicate_of`).
2. **Engine**: `dates.ts` (effective defer, due and deadline through
   milestone and project), `availability.ts` (the four checks in order,
   sequential projects and milestones), `urgency.ts`, `rolls.ts`
   (rolled days from `planned_on`, today in the caller's timezone),
   `ladders.ts` (due and deadline levels from today), `graph.ts`
   (dependency cycles, blocks-count). Unit-tested before any operation
   uses them.
3. **Operations**: dates through `UpdateTask` (a deadline change takes a
   `reason`); `PlanTask` (`POST /task/:id/plan`: day, optional block,
   counting a re-plan); milestones (`POST /task-project/:id/milestones`,
   `PUT`/`DELETE …/milestone/:milestoneId`, order); dependencies and
   relations (`POST`/`DELETE /task/:id/blocked-by/:otherId`,
   `POST`/`DELETE /task/:id/relations`); `ListTasks` gains `view`
   (`today`, `upcoming`, `waiting`, `available`) and returns each task's
   availability, effective dates, urgency, ladder levels, rolled days and
   blocks-count.
4. **Site**: Today, Upcoming (14 days by day) and Waiting; date pickers
   with quick defers (tomorrow, this weekend, next week, next month);
   chips for availability, "Blocks 3", due and deadline ladders; the
   Waiting prompt for _waiting on_ and follow-up; milestones on the
   project page.

**Sign-off:** T4, T5.

## Phase 3 — Calendar

1. No migration: blocks are `planned_start` and `planned_end`.
2. **Operations**: `ListTaskCalendar` (`GET /tasks/calendar?from&to`):
   time blocks, deadlines as all-day items, and per day the planned load
   (sum of estimates) against the free time the calendar leaves.
3. **Site**: a tasks layer on the Minerva calendar's week and day views
   (the FullCalendar setup the reviews already use): drag an unplanned
   task from a side list to block time, resize and move blocks, drag off
   to unplan; deadlines in the all-day row; a load bar per day. Blocks are
   drawn, never written to the calendar account.

**Sign-off:** T6.

## Phase 4 — Workflows and types

1. **Migration** `1791420000000_minerva_tasks_workflow_gates`: the gate
   columns (`kind`, `is_hard`, `message`, `field`, `link_type`, on a move
   or a status), and the seeding of the remaining presets for existing
   users: workflows Build, Bug, Parts, Epic; schemes Software, Hardware;
   an Epic type in Standard.
2. **Engine**: `gates.ts` (evaluate every gate on a move; hard refuses,
   soft needs a reason), `remap.ts` (status mapping by category, with an
   explicit override), epic progress (share of its tasks closed).
3. **Operations**: workflows (`ListTaskWorkflows`, `CreateTaskWorkflow`
   as a copy, `DescribeTaskWorkflow`, `UpdateTaskWorkflow` with statuses,
   moves and gates in one body, `DeleteTaskWorkflow` when unused); schemes
   likewise; `ChangeTaskProjectScheme` and `ChangeSchemeTypeWorkflow` with
   a mapping; `ConvertTaskToEpic`, `SplitTask`; `ChangeTaskStatus`
   returns the gates that failed.
4. **Site**: the board (columns from the workflow; drops only where a
   move is legal; a soft gate asks for a reason), the mixed board
   (columns by category, or a mapping you choose, prompting when a status
   has no column), the workflow editor (statuses, moves drawn as a graph,
   gates), the scheme editor (types, workflows, allowed parents), epics on
   the project page.

**Sign-off:** T7–T9.

## Phase 5 — Links

Goals' phase 9 is built here.

1. **Migration** `1791430000000_minerva_tasks_links`: `task_goals`
   (`task_id`, `goal_id`, optional `milestone_id`; pk on task and goal),
   `task_project_goals`, `task_links` (`item_type` under its `CHECK`,
   `item_id` text), and `review_items.task_id` (nullable, set null).
2. **Operations**: link and unlink for each; `GetTasksForEntity`
   (`GET /tasks/for/:itemType/:itemId`); `CreateTaskFromMailThread`;
   `TrackReviewItemAsTask` in the reviews feature. Goals: the `tasks`
   progress mode, a goal milestone ticking itself when its linked tasks
   are closed, and tasks (an epic's through its link) in the execution
   score.
3. **Site**: the Linked tasks panel (one component) on the goal page,
   meetings, notes and mail threads; task chips in the note editor (a key
   becomes a live chip with status and a tick box); "Make a task" on a
   mail thread; "Track as task" on review items; goal chips on tasks.

**Sign-off:** T10, T11 (and Goals' G12).

## Phase 6 — Repeats

1. **Migration** `1791440000000_minerva_tasks_repeats`: `task_repeats`
   (model incl. `quota`, frequency, interval, weekday mask, month day or
   Nth weekday, after-completion days, active months mask, quota count,
   lead days, ends after or on, paused, `track_only`, `remind_at`) and on
   `tasks`: `repeat_id`, `occurrence_on`, unique together; `behind_count`
   for aggregate; `reminded_at`. `task_quota_marks` (occurrence, local
   day, audit columns).
2. **Migration** `1791445000000_minerva_goals_habit_source` (ADR 0033,
   amending 0026): `goals.habit_source` (`logs`, `repeat`; default
   `logs`), `goals.repeat_id` (set null), the `CHECK`s; existing habit
   goals stay `logs`.
3. **Engine**: `repeats.ts` — next occurrence per model, lead-time
   defer, skip, window, quota periods, ends; pure and table-tested across
   month ends, leap years and DST. Goals' `progress/habits.ts` gains the
   `repeat` source: adherence and streaks from occurrences (done, Missed,
   skipped left out, quota marks over target), table-tested beside the
   `logs` source.
4. **Scheduler**: `TaskRepeatScheduler`, every 15 minutes behind
   `TASKS_SCHEDULER_ENABLED`, in the pattern of `WeatherRollupScheduler`:
   opens due occurrences, closes left-behind mark-missed and track-only
   ones as Missed and finished quota periods with their count, folds
   aggregate ones; publishes due reminders to the notification agent's
   exchange once per occurrence; idempotent on
   `(repeat_id, occurrence_on)`.
5. **Operations**: set, change, pause, end a repeat on a task; skip or
   move one occurrence; `MarkTaskQuota` (a completion inside a quota
   period, and its undo); `DescribeTaskRepeat` with its history;
   `CreateHabitGoalFromRepeat` and `RemindHabitWithTask`;
   `UnlinkHabitRepeat`. `LogGoalHabit` on a `repeat` goal closes or marks
   the open occurrence instead of writing a habit log.
6. **Signals**: track-only occurrences are excluded from overdue, due
   ladders, Keeps rolling and the reviews' attention lists.
7. **Site**: the repeat editor in the drawer (seven models, Track only,
   Reminder, the linked habit goal, Make a habit goal); the series
   history as a streak; the goal page's habit panel reading the series,
   with Remind me with a task and Unlink; quota occurrences as
   "1 of 3 this week" with a mark button.

**Sign-off:** T12, T16 (and Goals' G13).

## Phase 7 — Signals and reviews

1. **Engine**: `signals.ts` — Keeps rolling, Stale plan, Gone quiet,
   Follow up, Stalled project, Review due — from the thresholds in
   `task_user_settings`.
2. **Operations**: `ListTaskSignals` (by signal, for the reviews and
   Today), `MarkTaskProjectReviewed`, `UpdateTaskSettings`.
3. **Site**: signal markers everywhere tasks show; daily review Look back
   (done today, Keeps rolling, Follow up, missed deadlines) and Plan
   tomorrow (plan and block tasks onto tomorrow); weekly review (Stale,
   Gone quiet, Stalled projects, Projects to review one at a time, done
   by category); thresholds in Tasks settings.

**Sign-off:** T13.

## Phase 8 — Views and focus

1. **Migration** `1791450000000_minerva_tasks_views_focus`: `task_views`
   (name, filter text, sort, group, layout, board mapping rows in
   `task_view_columns`), `task_focuses`, `task_focus_members`, the active
   focus on settings, and Goals' hide-empty setting.
2. **Filter language** in `filter/`: grammar, parser with positions for
   errors, translation to Hasura `where`, computed predicates after the
   read; table-tested.
3. **Operations**: views CRUD; `ListTasks` takes `filter`; focuses CRUD
   and `SetActiveFocus`; Goals' and the reviews' operations apply the
   active focus.
4. **Site**: a filter bar that saves as a view; views in the sider; a
   task list block on Minerva Home and in the review steps; the focus
   switch in the Minerva header.

**Sign-off:** T14, T15.

## Later

- iOS: quick add, Today, the task sheet.
- Sharing projects and assignees, with its own decision record.
- Automation on transitions.
- OnAir: busy during time-blocked focus work.
- Reminders for ordinary tasks (due, deadline) through the notification
  agent; repeat reminders arrive in phase 6.
- Project templates.
- Other Olympus apps opening linked tasks (Harpocrates: "Renew …").
