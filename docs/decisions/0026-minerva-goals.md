# 0026. Minerva goals: per-user, relational, progress computed on read

- **Status:** Proposed
- **Date:** 2026-10-01

## Context

Minerva gains goal setting and tracking: the feature set agreed in the
[Goals core feature set](https://claude.ai/code/artifact/fe0e780b-d635-474a-9c97-36b31f229092)
and drawn on the [design canvas](https://claude.ai/artifact/WoB7NbaTpC3jXt7zWiuAM3).
In short:

- Four goal types: **outcome** (a number from a start value to a target),
  **milestone** (an ordered checklist), **habit** (occurrences on a
  schedule) and **achievement** (done or not).
- Any horizon: year, quarter, a 12-week cycle (twelve weeks plus a buffer
  week), custom dates, or ongoing. Cycles sit beside calendar quarters.
- Goals nest without a depth limit; a parent's progress is set by hand or
  rolled up from its sub-goals.
- Categories, each with a vision statement (six starter categories), plus
  free-form tags.
- Progress from check-ins (value, confidence, note), milestone ticks,
  habit logs and, once Tasks exists, linked tasks. A task may link to more
  than one goal.
- Two measures: outcome progress against a straight-line pace, and an
  execution score (planned goal work done in a week).
- Goals are checked in from their own page and from the daily and weekly
  reviews; the weekly check-in sits in the weekly review's Reflect step.

What the repository already has, and lacks:

- Minerva's tables (`minerva.notes`, `minerva.meetings`) carry an
  `author` string and no user; their operations take no identity.
  Per-user data with `@RequiresIdentity()` exists only in
  `olympus.weather_locations` (ADR 0024).
- Notes link to any entity through `minerva.note_associations`
  (`note_id`, `item_type`, `item_id`), read by `GetNotesForEntity`.
- There is no tag system in Minerva (Dionysus's content tags are their own
  thing), and no Tasks or Reviews feature: the Minerva menu lists Tasks
  and the reviews with no routes behind them.
- ADR 0007: relational schema only, no JSON documents in rows.

## Decision

### Goals belong to Minerva and to a user

- The feature is `minerva/goals` in the API, `minerva/goals/` in the
  model and `pages/minerva/goals` in the site. No new domain.
- Every goals table carries `user_id` (references `olympus.users`,
  cascade on delete). Every operation is `@RequiresIdentity()` and scoped
  to the caller, so another user's goal is a 404, never a 403, as with
  weather locations.
- Existing Minerva features are not changed by this. Moving notes and
  meetings to users is a separate decision.

### The schema, in the `minerva` schema

| Table                | Holds                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goal_categories`    | name, colour, icon, vision, position, archived                                                                                                                      |
| `goal_cycles`        | name, start date (a Monday), weeks (12), buffer weeks (1)                                                                                                           |
| `goals`              | category, parent, cycle, title, why, type, status, horizon, start and due dates, progress mode, rollup, weight, position; the outcome columns; closed date and note |
| `goal_habit_rules`   | one per habit goal: frequency, times per period, weekdays, quantity target and unit                                                                                 |
| `goal_milestones`    | title, due date, weight, position, done time                                                                                                                        |
| `goal_checkins`      | date, value, confidence, note, source                                                                                                                               |
| `goal_habit_logs`    | one per goal per local day: done, or a quantity                                                                                                                     |
| `tags`, `goal_tags`  | the shared tag system (below)                                                                                                                                       |
| `task_goals` (later) | arrives with Tasks: task, goal, optional milestone                                                                                                                  |

- Closed sets (type, status, horizon, confidence, frequency, progress
  mode, rollup, check-in source) are `text` columns with `CHECK`
  constraints, and string enums in the model, as the weather tables do.
- The outcome columns (unit, start value, target value, direction,
  tolerance) are on `goals`, required by a `CHECK` when the type is
  outcome and null otherwise. A habit's rule is its own table because it
  has its own lifecycle (a schedule can change mid-goal).
- Weekdays are a 7-bit mask (`smallint`, Monday = 1), not an array or a
  document.
- Dates a person picks (start, due, milestone due, check-in date, habit
  day) are `date`, not timestamps: a habit day is the caller's local day,
  from the `x-ncfritz-tz` header.
- **Every table carries `created_at` and `updated_at`**, join tables and
  one-per-goal tables included: `timestamp with time zone`, not null,
  default `now()`, with `updated_at` kept by
  `minerva.set_current_timestamp_updated_at()` through a
  `set_minerva_<table>_updated_at` trigger. Hasura exposes them as
  `createdTime` and `lastUpdatedTime`, and every model class has both,
  dropped from create and update shapes with `AUDIT_FIELDS`. A row that is
  replaced rather than updated (a habit rule saved again, a tag set on a
  goal) is updated in place by an upsert, so its `created_at` survives.
- Goals are soft-deleted (`deleted_at`) with a Restore operation, like
  notes. A goal with live sub-goals cannot be deleted (409).

### Notes link through `note_associations`

A note linked to a goal is a `note_associations` row with `item_type`
`goal`. No `goal_notes` table. The goal page reads them with the existing
`GetNotesForEntity`.

### Tags are a shared Minerva feature

`minerva.tags` (per user: name unique case-insensitively, colour) with
`goal_tags` as the first join table. Notes adopt it later with their own
join table. Tags get their own feature, `minerva/tags`, so that adoption
needs no change to Goals.

### Progress is computed on read, in the API

No cached progress columns and no triggers. The goals service loads a
goal set's rows and computes, in pure functions under
`minerva/goals/progress/`:

- **Progress** by type: outcome (current − start) ÷ (target − start),
  clamped to 0–100 %; milestone, the weighted share done; habit,
  adherence over the period; achievement, 0 or 100 %; rollup, the average,
  weighted average or sum of the sub-goals, walking the tree bottom-up.
- **Pace**: the straight line from start to target over the goal's dates,
  with the goal's tolerance band; outcome and milestone goals with a due
  date only.
- **Health**: the latest check-in's confidence, or, with none since the
  last change, the one pace suggests. A goal at risk or worse on three
  check-ins running is flagged for a decision.
- **Execution** for a week: habit occurrences done plus goal-linked tasks
  done, over those due or planned.

One user holds tens of goals and a few thousand log rows a year, so the
reads are small; every rule lives in one tested place; and there is no
cascade of triggers up a goal tree to keep consistent. If a list grows
slow, a SQL function in the pattern of the notes statistics comes next,
not a cache.

### Tasks and reviews arrive later

- The `tasks` progress mode and tasks in the execution score are added
  with Tasks, as a model contract change at that time.
- Check-ins record their `source` (goal page, daily review, weekly
  review). The review panels are built when the reviews are.

## Consequences

- Goals ships before Tasks, Reviews and tags on notes, and is useful
  alone: check-ins, milestones and habits carry progress.
- Minerva has two ownership models until notes and meetings move to
  users. Goal operations need a signed-in user; Minerva's others do not.
- Progress, pace and health are unit-tested as pure functions, and every
  list operation pays to compute them. Nothing can go stale.
- The model gains several enums, so the enum snapshot changes; adding the
  `tasks` progress mode later is a second, smaller contract change.
- A note can be linked to a goal before tags reach notes.
