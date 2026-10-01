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

## Phase 0 — Decision and scaffolding

1. **ADR 0026** reviewed and accepted.
2. **Model**: `minerva/goals/index.ts` and `minerva/tags.ts`, exported up
   to `src/index.ts`; no shapes yet.
3. **API**: `TagsModule` and `GoalsModule` in `MINERVA_MODULES`, no
   operations.
4. **Site**: a Goals entry in the Minerva menu (`AimOutlined`), between
   Tasks and Review, opening an empty `pages/minerva/goals/index.tsx`
   behind the sign-in the weather widget already uses.

**Sign-off:** the API boots, the menu entry opens the page, and the
Turbo tasks pass.

## Phase 1 — Tags

1. **Migration** `<ts>_minerva_tags`: `minerva.tags` — `id` (uuid),
   `user_id` (references `olympus.users`, cascade), `name` (not blank),
   `colour` (optional, `#rrggbb` checked), audit columns.
   Unique `(user_id, lower(name))`.
2. **Operations**, tag `Tags`:

   | Operation   | Route                |
   | ----------- | -------------------- |
   | `ListTags`  | `GET /tags`          |
   | `CreateTag` | `POST /tags`         |
   | `UpdateTag` | `PUT /tag/:tagId`    |
   | `DeleteTag` | `DELETE /tag/:tagId` |

   A duplicate name (any case) is a 409. `ListTags` takes an optional
   `prefix` for the tag picker and returns each tag's use count. Deleting
   a tag removes it from everything it is on.

3. **Tests**: converter units; endpoint tests including another user's
   tag (404), no identity (401), duplicate (409) and bad input (400,
   before Hasura).

**Sign-off:** G1 from the OpenAPI page.

## Phase 2 — Categories and cycles

1. **Migration** `<ts>_minerva_goal_categories_cycles`:
   - `minerva.goal_categories`: `id`, `user_id`, `name` (not blank,
     unique per user), `colour`, `icon` (an icon name from a fixed list
     in the model), `vision` (text, optional), `position` (unique per
     user, deferred), `archived_at`, audit columns.
   - `minerva.goal_cycles`: `id`, `user_id`, `name`, `start_date`
     (checked to be a Monday), `weeks` (default 12, 1–26),
     `buffer_weeks` (default 1, 0–2), audit columns. Unique
     `(user_id, start_date)`; overlap is refused by the API (409).
2. **Starter categories**: the first `ListGoalCategories` for a user with
   none inserts Health, Work, Relationships, Finance, Learning and Home
   (no visions), in one mutation, so every later list sees them. Renaming
   or deleting them is like any other.
3. **Operations**, tags `Goal Categories` and `Goal Cycles`:

   | Operation               | Route                                |
   | ----------------------- | ------------------------------------ |
   | `ListGoalCategories`    | `GET /goals/categories`              |
   | `CreateGoalCategory`    | `POST /goals/categories`             |
   | `UpdateGoalCategory`    | `PUT /goals/category/:categoryId`    |
   | `DeleteGoalCategory`    | `DELETE /goals/category/:categoryId` |
   | `ReorderGoalCategories` | `PUT /goals/categories/order`        |
   | `ListGoalCycles`        | `GET /goals/cycles`                  |
   | `CreateGoalCycle`       | `POST /goals/cycles`                 |
   | `UpdateGoalCycle`       | `PUT /goals/cycle/:cycleId`          |
   | `DeleteGoalCycle`       | `DELETE /goals/cycle/:cycleId`       |

   Deleting a category with goals in it is a 409 unless the body names a
   category to move them to; archiving hides it from pickers and keeps
   its goals. Deleting a cycle leaves its goals with their dates and no
   cycle. `ListGoalCycles` marks the current one and each cycle's week
   for today, in the caller's timezone.

4. **Tests**: as phase 1, plus the starter set appearing exactly once
   under two concurrent first lists.

**Sign-off:** G2 from the OpenAPI page.

## Phase 3 — Goals

1. **Migration** `<ts>_minerva_goals`:
   - `minerva.goals`: `id`, `user_id`, `category_id` (restrict),
     `parent_id` (self, restrict), `cycle_id` (set null), `title`,
     `why`, `type`, `status` (`draft`, `active`, `paused`, `achieved`,
     `missed`, `dropped`), `horizon` (`year`, `quarter`, `cycle`,
     `custom`, `ongoing`), `start_date`, `due_date` (null only when
     ongoing), `progress_mode` (`manual`, `checkins`, `milestones`,
     `habit`, `subgoals`), `rollup` (`average`, `weighted`, `sum`),
     `weight`, `manual_progress`, `position`, outcome columns (`unit`,
     `start_value`, `target_value`, `direction` `up`/`down`,
     `tolerance_pct`, default 10), `closed_on`, `close_note`,
     `deleted_at`, audit columns. `CHECK`s: the outcome columns together
     exactly when the type is outcome; `due_date >= start_date`; a cycle
     only when the horizon is cycle; `progress_mode` allowed for the type
     (habit → habit; milestone → milestones or subgoals; outcome →
     checkins or subgoals; achievement → manual).
   - `minerva.goal_habit_rules`: `goal_id` (pk, cascade), `frequency`
     (`daily`, `weekly`, `weekdays`, `monthly`), `times_per_period`,
     `weekdays` (bitmask 1–127, required for `weekdays`),
     `quantity_target`, `quantity_unit`, audit columns. Saving a goal's
     rule again is an upsert on `goal_id`, so `created_at` survives.
   - `minerva.goal_milestones`: `id`, `goal_id` (cascade), `title`,
     `due_date`, `weight` (default 1), `position`, `done_at`, audit
     columns.
   - `minerva.goal_tags`: `goal_id`, `tag_id` (both cascade), audit
     columns, primary key on the pair. Setting a goal's tags removes the
     dropped ones and inserts the new ones, leaving the kept rows as they
     were.
   - The API refuses a parent that would make a cycle (a goal under its
     own descendant): 400.
2. **Progress engine** in `goals/progress/`, pure and unit-tested before
   any controller uses it: `outcomeProgress`, `milestoneProgress`,
   `habitAdherence` (periods by the rule, in a given timezone),
   `rollup` (bottom-up over a tree, with the three methods; `sum` only
   when the children share a unit), `pace` (expected value and band on a
   date), `health`. Tables of cases, including direction `down`, a target
   already passed, a goal paused part-way and a habit whose rule changed.
3. **Operations**, tag `Goals`:

   | Operation               | Route                                         |
   | ----------------------- | --------------------------------------------- |
   | `ListGoals`             | `GET /goals`                                  |
   | `CreateGoal`            | `POST /goals`                                 |
   | `DescribeGoal`          | `GET /goal/:goalId`                           |
   | `UpdateGoal`            | `PUT /goal/:goalId`                           |
   | `DeleteGoal`            | `DELETE /goal/:goalId`                        |
   | `RestoreGoal`           | `POST /goal/:goalId/restore`                  |
   | `ReorderGoals`          | `PUT /goals/order`                            |
   | `CreateGoalMilestone`   | `POST /goal/:goalId/milestones`               |
   | `UpdateGoalMilestone`   | `PUT /goal/:goalId/milestone/:milestoneId`    |
   | `DeleteGoalMilestone`   | `DELETE /goal/:goalId/milestone/:milestoneId` |
   | `ReorderGoalMilestones` | `PUT /goal/:goalId/milestones/order`          |
   - `ListGoals` filters by status (default: draft, active and paused),
     category, cycle, horizon, tag and parent, and returns every goal
     with its computed progress, expected progress, health and the ids of
     its sub-goals, so the site can draw the board, roadmap and focus
     list from one call.
   - `DescribeGoal` returns the `FullGoal`: the goal, its habit rule,
     milestones, sub-goals (one level, with their progress) and tags.
   - `CreateGoal` takes the habit rule, milestones and tag ids in the same
     body and writes them in one mutation, with a `Location` header.
   - Status changes go through `UpdateGoal`; moving to `achieved`,
     `missed` or `dropped` needs `closedOn` and sets nothing else (the
     close-out comes in phase 4).

4. **Tests**: the engine's tables; converter units; endpoint tests per
   operation, including another user's goal (404), a parent cycle (400),
   an outcome without a target (400), deleting a goal with sub-goals
   (409), and the rollup of a three-level tree in `ListGoals`.

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
