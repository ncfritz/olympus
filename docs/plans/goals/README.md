# Goals: phased implementation plan

The implementation of [ADR 0026](../../decisions/0026-minerva-goals.md)
and the [design](design.md). Each phase ends in a working, deployable
state and a functional sign-off against [signoff.md](signoff.md).

| Phase | Delivers                                                                        | Depends on                      | Sign-off flows |
| ----- | ------------------------------------------------------------------------------- | ------------------------------- | -------------- |
| 0     | ADR accepted; empty feature in the model, API and site; the Goals menu entry    | —                               | —              |
| 1     | Tags: the shared Minerva tag system                                             | 0                               | G1 (API)       |
| 2     | Categories and cycles                                                           | 0                               | G2 (API)       |
| 3     | Goals: the four types, sub-goals, lifecycle, the progress engine                | 1, 2                            | G3, G4 (API)   |
| 4     | Check-ins and habit logs; pace, health, execution; close-out                    | 3                               | G5–G7 (API)    |
| 5     | The site: Goals home, goal page, new goal, check-in, categories and tags        | 4                               | G1–G8          |
| 6     | Notes on goals, through `note_associations`                                     | 5                               | G9             |
| 7     | Minerva Home: the goals strip and today's habits                                | 5                               | G10            |
| 8     | The reviews: daily habits and goals, the weekly check-in in Reflect, priorities | 5; the daily and weekly reviews | G11            |
| 9     | Tasks: `task_goals`, the `tasks` progress mode, tasks in the execution score    | 5; Tasks                        | G12            |
| Later | iOS Goals view; reminders and nudges; automatic metric sources; quarter retro   |                                 |                |

Phases 1 and 2 are independent of each other. Phases 6 and 7 can run in
either order once the site is in.

## Where the code goes

| What         | Where                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Model shapes | `packages/model/src/minerva/`: `tags.ts`, and `goals/` (`categories.ts`, `cycles.ts`, `goals.ts`, `checkins.ts`, `habits.ts`, `index.ts`)       |
| API: tags    | `apps/api/src/minerva/tags/`: `TagsModule`, `controllers/`, `services/TagService.ts`, `converters/`, `queries/`                                 |
| API: goals   | `apps/api/src/minerva/goals/`: `GoalsModule`, `controllers/`, `services/`, `converters/`, `queries/`, `progress/` (pure functions)              |
| Schema       | `infra/hasura/migrations/olympus/<ts>_minerva_*`, with metadata (custom camelCase column names, as every table)                                 |
| Site         | `apps/site/src/pages/minerva/goals/`, `src/components/minerva/goals/`, `src/api/goalsApi.ts`, the entry in `components/minerva/layout/menu.tsx` |

The operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Controllers are thin; the services own the
Hasura documents; `progress/` owns every rule about progress, pace,
health and execution and does no I/O. Every operation is
`@RequiresIdentity()`, takes the caller with `requireUser(principal)` and
passes `user.userId` to the service, which scopes every query by it.

Every table below has the audit columns: `created_at` and `updated_at`
(`timestamp with time zone`, not null, default `now()`), the
`set_minerva_<table>_updated_at` trigger on
`minerva.set_current_timestamp_updated_at()`, and the custom names
`createdTime` and `lastUpdatedTime` in the metadata. Each phase's
migration test checks that an update moves `updated_at` and leaves
`created_at`.

No new configuration: the feature has no provider, secret or schedule.

## Phase 0 — Decision and scaffolding — done 2026-10-01

1. **ADR 0026 accepted**: **done** 2026-10-01.
2. **Model**: **done** — `minerva/goals/index.ts` and `minerva/tags.ts`, exported up
   to `src/index.ts`; no shapes yet.
3. **API**: **done** — `TagsModule` and `GoalsModule` in `MINERVA_MODULES`, no
   operations.
4. **Site**: **done** — a Goals entry in the Minerva menu (`AimOutlined`), between
   Tasks and Review, opening an empty `pages/minerva/goals/index.tsx`
   behind the sign-in the weather widget already uses.

**Sign-off:** the API boots, the menu entry opens the page, and the
Turbo tasks pass.

## Phase 1 — Tags — done 2026-10-01

1. **Migration** `1790900000000_minerva_tags`: **done** — `minerva.tags`:
   `id` (uuid), `user_id` (references `olympus.users`, cascade), `name`
   (1 to 50 characters, not blank), `color` (optional, lowercase
   `#rrggbb`), audit columns. Unique `(user_id, lower(name))`. Hasura:
   admin only, custom column names in camelCase.
2. **Operations**, tag `Tags`: **done**

   | Operation     | Route                |
   | ------------- | -------------------- |
   | `ListTags`    | `GET /tags`          |
   | `CreateTag`   | `POST /tags`         |
   | `DescribeTag` | `GET /tag/:tagId`    |
   | `UpdateTag`   | `PUT /tag/:tagId`    |
   | `DeleteTag`   | `DELETE /tag/:tagId` |

   A duplicate name (any case) is a 409. `ListTags` takes an optional
   `prefix` for the tag picker, matched case-insensitively with LIKE's own
   characters taken as text. Create trims the name, lowercases the colour
   and answers with a `Location` header (hence `DescribeTag`). Update
   renames or recolours (`color: null` removes it); an empty change is a 304. Deleting a tag removes it from everything it is on (the join
   tables cascade). Each tag's use count arrives with `goal_tags` in
   phase 3.

3. **Tests**: **done** — converter units; endpoint tests including
   another user's tag (404), no identity (401), duplicate (409) and bad
   input (400, before Hasura); `infra/hasura/tests/minerva_tags.sql` for
   the table's constraints, audit times and cascade, run against the
   migrations applied over the baseline, with `down.sql` exercised.
4. **Fix on the way**: Dionysus's `CreateContentAssetTag` sent a Hasura
   document named `CreateTag`, which the one-name-one-document check
   caught once Minerva's `CreateTag` existed. It is now named after its
   operation.

**Sign-off:** G1 from the OpenAPI page.

## Phase 2 — Categories and cycles — done 2026-10-01

1. **Migration** `1790910000000_minerva_goal_categories_cycles`: **done**
   - `minerva.goal_user_settings`: `user_id` (primary key, cascade),
     `starter_categories_at`, audit columns. One row per user who has used
     Goals; it records that the starter categories were given, so a user
     who deletes them all is not given them again.
   - `minerva.goal_categories`: `id`, `user_id`, `name` (1 to 50, unique
     per user whatever the case), `color` (required, lowercase
     `#rrggbb`), `icon` (one of the model's `GoalCategoryIcon`: heart,
     laptop, team, wallet, book, home, star, compass, trophy, smile),
     `vision` (at most 2,000 characters), `position` (unique per user,
     deferred), `archived_at`, audit columns.
   - `minerva.goal_cycles`: `id`, `user_id`, `name` (1 to 50),
     `start_date` (a Monday), `weeks` (default 12, 1–26), `buffer_weeks`
     (default 1, 0–2), audit columns. Unique `(user_id, start_date)`;
     overlap, buffer weeks included, is refused by the API (409).
2. **Starter categories**: **done** — the first `ListGoalCategories` for a
   user with no settings row inserts the row and Health, Work,
   Relationships, Finance, Learning and Home (each with a colour and icon,
   no vision) after any categories the user already has, skipping names
   they already use, in one mutation (`GiveStarterGoalCategories`). A
   concurrent first read that got there first makes the settings insert a
   conflict and this one gives nothing. `CreateGoalCategory` lists first,
   so the starter set is never given after a user's own categories by
   surprise.
3. **Operations**, tags `Goal Categories` and `Goal Cycles`: **done**

   | Operation               | Route                                |
   | ----------------------- | ------------------------------------ |
   | `ListGoalCategories`    | `GET /goals/categories`              |
   | `CreateGoalCategory`    | `POST /goals/categories`             |
   | `ReorderGoalCategories` | `PUT /goals/categories/order`        |
   | `DescribeGoalCategory`  | `GET /goals/category/:categoryId`    |
   | `UpdateGoalCategory`    | `PUT /goals/category/:categoryId`    |
   | `DeleteGoalCategory`    | `DELETE /goals/category/:categoryId` |
   | `ListGoalCycles`        | `GET /goals/cycles`                  |
   | `CreateGoalCycle`       | `POST /goals/cycles`                 |
   | `DescribeGoalCycle`     | `GET /goals/cycle/:cycleId`          |
   | `UpdateGoalCycle`       | `PUT /goals/cycle/:cycleId`          |
   | `DeleteGoalCycle`       | `DELETE /goals/cycle/:cycleId`       |
   - Categories: `archived: true` archives (hides from pickers, keeps its
     goals) and `false` brings it back; `vision: null` removes the vision;
     an empty change is a 304; a duplicate name is a 409. Reorder names
     every category, archived ones included. Deleting a category that
     holds goals needs `moveTo` (built in phase 3).
   - Cycles: listed latest first. Each answers its `endDate` (the last
     day of the execution weeks), `bufferEndDate`, `status` (upcoming,
     current, buffer, past) and, while current or in its buffer,
     `currentWeek`, all from today in the caller's timezone
     (`x-ncfritz-tz`; an unknown zone is a 400). Weeks default to 12 and
     buffer weeks to 1.
   - Each Describe operation exists so that Create answers with a
     `Location` header.

4. **Tests**: **done** — converter and date units (cycle status and week
   on every boundary; today in Seattle against UTC); endpoint tests for
   all eleven operations, including the starter set given once, the
   concurrent first read, another user's ids (404), no identity (401),
   overlaps and duplicates (409) and bad input (400, before Hasura);
   `infra/hasura/tests/minerva_goal_categories_cycles.sql` for the
   tables' constraints, the deferred position swap, audit times and
   cascade, with `down.sql` exercised. `test/support/signedInApp.ts` holds
   the signed-in test harness the goals specs share.

**Sign-off:** G2 from the OpenAPI page.

## Phase 3 — Goals — done 2026-10-01

1. **Migration** `1790920000000_minerva_goals`: **done**
   - `minerva.goals`: `id`, `user_id` (cascade), `category_id`
     (restrict), `parent_id` (self, restrict, never itself), `cycle_id`
     (restrict), `title` (1 to 120), `why` (at most 500), `type`
     (`outcome`, `milestone`, `habit`, `achievement`), `status` (`draft`,
     `active`, `paused`, `achieved`, `missed`, `dropped`), `horizon`
     (`year`, `quarter`, `cycle`, `custom`, `ongoing`), `start_date`,
     `due_date`, `progress_mode`, `rollup` (`average`, `weighted`,
     `sum`), `weight` (default 1), `manual_progress` (0–100), `position`,
     outcome columns (`unit`, `start_value`, `target_value`),
     `tolerance_pct` (1–50, default 10), `closed_on`, `close_note`,
     `deleted_at`, audit columns. `CHECK`s:
     - the progress mode allowed for the type: outcome → checkins or
       subgoals; milestone → milestones, subgoals or manual; habit →
       habit; achievement → status;
     - `rollup` exactly when the mode is subgoals, and `sum` only for an
       outcome; `manual_progress` exactly when the mode is manual;
     - the start and target values exactly when the type is outcome, and
       different; a unit only for an outcome;
     - `due_date >= start_date`; no due date exactly when ongoing; a cycle
       exactly when the horizon is cycle; `closed_on` exactly when the
       goal is achieved, missed or dropped.
   - `minerva.goal_habit_rules`: `goal_id` (pk, cascade), `frequency`
     (`daily`, `weekly`, `weekdays`, `monthly`), `times_per_period` (1 for
     daily and weekdays, up to 7 weekly, up to 31 monthly), `weekdays`
     (bitmask 1–127, exactly for `weekdays`), `quantity_target`,
     `quantity_unit` (only with a target), audit columns. Saving a goal's
     rule again is an upsert on `goal_id`, so `created_at` survives.
   - `minerva.goal_milestones`: `id`, `goal_id` (cascade), `title`,
     `due_date`, `weight` (default 1), `position` (unique per goal,
     deferred), `done_at`, audit columns.
   - `minerva.goal_tags`: `goal_id`, `tag_id` (both cascade), audit
     columns, primary key on the pair. Setting a goal's tags removes the
     dropped ones and inserts the new ones, leaving the kept rows as they
     were.
   - Changed from the first draft: no `direction` column (an outcome goes
     down when its target is below its start); an achievement's mode is
     `status` and manual progress is for milestone goals only; the cycle
     key is restrict, and `DeleteGoalCycle` makes the cycle's goals
     custom-horizon goals in the same mutation.
2. **Progress engine** in `goals/progress/`: **done** — pure functions,
   unit-tested before any controller used them:
   - `measures.ts`: outcome progress (either direction, clamped 0–100, a
     target already passed is 100), milestone progress (by weight),
     `pace` (expected progress from start to due, 100 on the due day) and
     health against the goal's tolerance (on track within it, at risk
     within twice it, off track beyond);
   - `habits.ts`: adherence over the last 28 days, 4 weeks or 3 months
     by the rule, the current period counting only as much as is done,
     the start date clipping the first period, and the current and best
     streak; health at 80 % and 60 %;
   - `engine.ts`: `computeProgress(goals, today)` rolls sub-goals up
     bottom-up (average, weighted or sum), guards against a cycle, counts
     an achieved goal as 100, leaves dropped and deleted sub-goals out,
     and gives health only to active goals.
   - Limits until the history exists: the engine reads the goal and rule
     as they are now, so a goal paused part-way has no pace and a habit
     whose rule changed is measured by the new rule throughout.
     Check-ins and habit logs come in phase 4; until then an outcome
     reads its start value and a habit has no completions.
3. **Operations**, tag `Goals`: **done**

   | Operation               | Route                                         |
   | ----------------------- | --------------------------------------------- |
   | `ListGoals`             | `GET /goals`                                  |
   | `CreateGoal`            | `POST /goals`                                 |
   | `ReorderGoals`          | `PUT /goals/order`                            |
   | `DescribeGoal`          | `GET /goal/:goalId`                           |
   | `UpdateGoal`            | `PUT /goal/:goalId`                           |
   | `DeleteGoal`            | `DELETE /goal/:goalId`                        |
   | `RestoreGoal`           | `POST /goal/:goalId/restore`                  |
   | `CreateGoalMilestone`   | `POST /goal/:goalId/milestones`               |
   | `ReorderGoalMilestones` | `PUT /goal/:goalId/milestones/order`          |
   | `UpdateGoalMilestone`   | `PUT /goal/:goalId/milestone/:milestoneId`    |
   | `DeleteGoalMilestone`   | `DELETE /goal/:goalId/milestone/:milestoneId` |
   - Every operation reads the user's goals whole (a user holds tens) and
     works progress out for today in the caller's timezone.
   - `ListGoals` filters by status (a comma list; default draft, active
     and paused), category, cycle, horizon, tag and parent (`none` for top
     level), and returns each goal with its progress, current value,
     expected progress, health, tag ids and sub-goal ids, so the site can
     draw the board, roadmap and focus list from one call.
   - `DescribeGoal` returns the `FullGoal`: the goal, its habit rule
     (weekdays as ISO days), milestones, sub-goals (one level, with their
     progress) and tags. It describes a deleted goal too, marked
     `deleted`.
   - `CreateGoal` takes the habit rule, milestones and tag ids in the same
     body and writes them in one mutation, last in order, with a
     `Location` header. A new goal is draft or active. A cycle goal with
     no dates takes its cycle's start and end.
   - `UpdateGoal` lays the changes over the goal as it stands and checks
     the whole, then sends one mutation for the goal, its rule and its
     tags. A goal's type cannot change (400). Moving to `achieved`,
     `missed` or `dropped` needs `closedOn` (the close-out comes in phase
     4); reopening clears it. Naming nothing is a 304; naming only what
     is already so answers the goal without a mutation.
   - `DeleteGoal` is soft (`deleted_at`) and refuses a goal with live
     sub-goals (409). `RestoreGoal` refuses a goal that is not deleted or
     whose parent is (409).
   - `ReorderGoals` takes some goals and shares the positions they
     already hold out in the order given, so a board column reorders
     alone. `ReorderGoalMilestones` names every milestone exactly once.
   - `CreateGoalMilestone` answers 201 with no `Location`: a milestone
     has no route of its own to read it from.
   - The rules phase 2 deferred: deleting a category with goals needs
     `?moveTo=<categoryId>` and moves them in the same mutation (409
     without it); every tag answers `goalCount`, its live goals.

4. **Tests**: **done** — the engine's tables (65 cases), converter and
   value-check units, and endpoint tests for all eleven operations:
   another user's goal (404), a parent under its own sub-goal (400), an
   outcome without a target (400), every cross-field rule (400, before
   Hasura), deleting a goal with sub-goals (409), restore's two refusals
   (409), the rollup of a three-level tree in `ListGoals`, and the exact
   variables each mutation sends. `infra/hasura/tests/minerva_goals.sql`
   checks every `CHECK`, key and cascade, with `down.sql` exercised.

**Sign-off:** G3 and G4 from the OpenAPI page.

## Phase 4 — Check-ins, habits and execution

1. **Migration** `<ts>_minerva_goal_checkins_habits`:
   - `minerva.goal_checkins`: `id`, `goal_id` (cascade), `checkin_date`,
     `value` (numeric, required for outcome goals), `confidence`
     (`on_track`, `at_risk`, `off_track`), `note`, `source` (`goal`,
     `daily_review`, `weekly_review`), audit columns. Index
     `(goal_id, checkin_date desc)`.
   - `minerva.goal_habit_logs`: `id`, `goal_id` (cascade), `log_date`,
     `done` (boolean), `quantity`, `note`, audit columns. Unique
     `(goal_id, log_date)`; logging the same day again is an upsert.
2. **Operations**:

   | Operation              | Route                                     |
   | ---------------------- | ----------------------------------------- |
   | `ListGoalCheckins`     | `GET /goal/:goalId/checkins`              |
   | `CreateGoalCheckin`    | `POST /goal/:goalId/checkins`             |
   | `UpdateGoalCheckin`    | `PUT /goal/:goalId/checkin/:checkinId`    |
   | `DeleteGoalCheckin`    | `DELETE /goal/:goalId/checkin/:checkinId` |
   | `SuggestGoalCheckin`   | `GET /goal/:goalId/checkin/suggestion`    |
   | `LogGoalHabit`         | `PUT /goal/:goalId/habit/:date`           |
   | `DeleteGoalHabitLog`   | `DELETE /goal/:goalId/habit/:date`        |
   | `ListGoalHabitLogs`    | `GET /goal/:goalId/habit`                 |
   | `ListGoalHabitsForDay` | `GET /goals/habits/:date`                 |
   | `GetGoalExecution`     | `GET /goals/execution`                    |
   | `CloseGoal`            | `POST /goal/:goalId/close`                |
   - `SuggestGoalCheckin` answers the form's defaults: the current value,
     the expected value today and the confidence pace suggests.
   - `ListGoalHabitsForDay` is the "today's habits" strip: every active
     habit due on the caller's local day, with its log if any and the
     period's count so far.
   - `GetGoalExecution` takes an ISO week (`2026-W40`) or a cycle and
     answers the score overall, per goal and per day, done over due.
   - `CloseGoal` records the final status, date, final value or
     progress, and a lessons note; it is the one way into `achieved`,
     `missed` or `dropped` from here on.
   - Check-in and log dates in the future are a 400; a backfilled date
     is fine.

3. **Engine additions**: execution, and the at-risk streak (three
   check-ins running at risk or worse) surfaced as a flag on the goal in
   `ListGoals` and `DescribeGoal`.
4. **Tests**: engine tables for execution across a week boundary in two
   timezones; endpoint tests per operation; a habit day that is today in
   Seattle and tomorrow in UTC.

**Sign-off:** G5–G7 from the OpenAPI page.

## Phase 5 — The site

Built with AntD's own components in their standard style; charts with
Highcharts, which the site already uses; dates with Luxon.

1. **`goalsApi.ts`** and **`tagsApi.ts`** over the SDK, as the other
   `src/api` classes.
2. **Goals home** (`/minerva/goals`): the Board, Roadmap and Focus views
   behind one `Segmented` switch, the horizon, tag and status filters,
   the summary strip. Built in the order chosen in the design review
   (see [design.md](design.md#open)); the first view ships alone if
   needed.
3. **Goal page** (`/minerva/goals/:goalId`): header, the type's panel
   (outcome chart with pace band and projection; milestone checklist;
   habit 12-week grid with streaks; achievement toggle), sub-goals,
   linked tasks placeholder, and the right-hand sider with the check-in
   form and history.
4. **New and edit goal**: the form that adapts to the type (or the guided
   steps, per the design review), in a drawer.
5. **Check-in**: the sider form on the goal page and the same form as a
   modal from any list row.
6. **Categories and tags**: a management drawer (reorder, vision, colour,
   archive), and a tag picker that creates tags inline.
7. **Tests**: component tests with MSW for the goal page and the check-in
   form; a Playwright smoke of create → check in → close.

**Sign-off:** G1–G8 on the site.

## Phase 6 — Notes on goals

1. `note_associations` rows with `item_type` `goal`; the model's
   association type gains `Goal`.
2. The goal page lists them through `GetNotesForEntity`, with Link note
   (search existing) and New note (opens `NotesEditorModal` with the
   association set).
3. The note editor's associations picker offers goals.

**Sign-off:** G9.

## Phase 7 — Minerva Home

The goals strip (this cycle or quarter, health) and today's habits with
one-tap logging, from `ListGoals` and `ListGoalHabitsForDay`.

**Sign-off:** G10.

## Phase 8 — The reviews

Built with or after the daily and weekly reviews, which do not exist yet.

1. Daily Look back: habits due today, logged in place; goals that moved.
2. Daily Plan tomorrow: Top 3 and "track as task" offer a goal link.
3. Weekly Look back: progress change per goal, the execution score
   against 85 %, at-risk flags.
4. Weekly Reflect: one row per active goal (value, confidence, note),
   pre-filled from `SuggestGoalCheckin`, saved as check-ins with source
   `weekly_review`.
5. Weekly Plan next week: priorities picked from active goals.

**Sign-off:** G11.

## Phase 9 — Tasks

Built with Tasks.

1. **Migration**: `minerva.task_goals` (`task_id`, `goal_id`, optional
   `milestone_id`, audit columns; primary key on task and goal).
2. The `tasks` progress mode (milestone and outcome goals), a milestone
   ticking itself when its linked tasks are all done, and tasks in the
   execution score.
3. Goal chips on tasks; the goal page's linked tasks section goes live.

**Sign-off:** G12.

## Later

- iOS: the Goals view, today's habits and the check-in sheet.
- Reminders and nudges (a habit not logged by evening; a goal with no
  check-in for two weeks), through the notification agent.
- Automatic metric sources for outcome goals: other Olympus data (the
  weather stations' series, for one) feeding check-ins.
- A quarter or cycle retrospective built from close-outs.
