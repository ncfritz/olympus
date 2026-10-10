# 0033. Minerva tasks: one tree, typed leaves, workflows as data, state computed on read

- **Status:** Proposed
- **Date:** 2026-10-09

## Context

Minerva gains task and project management: the feature set agreed in the
[Minerva Tasks core feature set](https://claude.ai/code/artifact/6785948c-e2bb-450e-ad56-5bb02859aca6),
reached from the survey and three rounds of decisions in
[Tasks: landscape and direction](https://claude.ai/code/artifact/a51e56d0-f88d-40bf-b650-0b8c3bd4f570).
In short:

- One system for deep builds (Olympus, the drop rig) and flat chore
  lists: OmniFocus's planning model (defer, planned and due dates,
  sequential work, reviews) with Jira's and Linear's project structure
  (components, epics, workflows, boards).
- A task lives in exactly one project and is always a leaf: no sub-tasks.
  Work is broken down by converting a task to an epic or splitting it,
  never by nesting, so a task is not re-defined further down a tree.
- Workflows are state machines you can define, with gates on moves.
  Each item type in a project has its own workflow.
- Status is richer than done or not done, and "pending" splits in two:
  waiting on another task (blocked, computed) and waiting on the world
  (the Waiting status, set by you).
- A due date and a separate deadline, each with its own warning ladder.
- Six repeat models, including mark-missed and aggregate.
- Tasks link to goals and to anything else in Olympus, and any page can
  show the tasks about it.
- Project work spans personal and professional life, so focus modes keep
  Goals and Tasks uncluttered.

What the repository already has:

- Goals (ADR 0026) plans `minerva.task_goals` and a `tasks` progress mode
  in its phase 9, and counts goal-linked tasks in the execution score.
- The reviews (ADR 0027) keep plan items as rows; "Track as task" adds a
  nullable `task_id` to `minerva.review_items` once Tasks exists.
- Notes link to anything through `minerva.note_associations`, whose
  `item_type` is free text.
- The shared tag system `minerva.tags` (ADR 0026) is ready for a
  `task_tags` join table.
- Per-user tables with `@RequiresIdentity()`, values computed on read in
  pure functions, `text` + `CHECK` enums, audit columns on every table,
  and no JSON in rows (ADR 0007).
- The API already runs an in-process scheduler behind a flag
  (`WeatherRollupScheduler`).

## Decision

### Tasks belong to Minerva and to a user

- The feature is `minerva/tasks` in the API, `minerva/tasks/` in the
  model and `pages/minerva/tasks` in the site.
- Every table carries `user_id` (references `olympus.users`, cascade).
  Every operation is `@RequiresIdentity()` and scoped to the caller;
  another user's row is a 404.
- `tasks.assignee_id` (nullable, references `olympus.users`) is in the
  schema from the start and unused until sharing is designed. Sharing a
  project is a later decision.

### One tree; a task is always a leaf

| Level          | Table                  | Holds                       | Notes                                                             |
| -------------- | ---------------------- | --------------------------- | ----------------------------------------------------------------- |
| Folder         | `task_folders`         | folders, projects           | Any depth; organizing only                                        |
| Project        | `task_projects`        | components, epics, tasks    | Key (`MIN`), scheme, kind (parallel or sequential), status, dates |
| Component      | `task_components`      | epics, tasks                | Flat, ordered, archivable                                         |
| Epic           | `tasks` (container)    | tasks                       | An item type marked container; one level only                     |
| Task           | `tasks` (leaf)         | checklist lines             | Task, Story, Bug, Part… per the scheme                            |
| Checklist line | `task_checklist_items` | —                           | No status, no dates; can be promoted to a task                    |
| Milestone      | `task_milestones`      | tasks, as a field on a task | Cuts across components and epics; may be sequential               |

- `tasks.project_id` is required. `component_id`, `parent_id` (an epic in
  the same project) and `milestone_id` are optional. A `CHECK` and the
  service keep a container from having a parent and a leaf from holding
  children.
- Each user has one built-in Inbox project (`task_user_settings.
inbox_project_id`, Checklist scheme). Quick add files there.
- **Convert to epic** changes a task's type to a container type in place:
  same row, key, notes, links and history. **Split** creates tasks with a
  `split_from` relation. Neither re-parents existing history.
- **Keys.** A project has a key (2–6 capitals) and a counter; a task's key
  is `<project key>-<number>`. Moving a task to another project gives it a
  new key and records the old one in `task_key_aliases`, so links and note
  chips still resolve.
- **Categories** (`task_categories`, per user, flat) are set on folders
  and projects and inherited. A category may name the goal category (life
  area) it serves. Goals keeps its own categories as life areas.

### Item types, schemes and workflows are data

- `task_workflows`, `task_workflow_statuses`, `task_workflow_moves`,
  `task_workflow_gates`: a workflow is a set of statuses, each in one of
  six fixed categories (`backlog`, `todo`, `in_progress`, `waiting`,
  `done`, `canceled`), exactly one starting status (in backlog or to do),
  at least one done status, the allowed moves (none listed means any to
  any) and gates.
- `task_schemes`, `task_scheme_types`, `task_scheme_parents`: a scheme is
  the item types a project allows. Each type has a name, icon, container
  or leaf, and **its own workflow**; each leaf type lists the container
  types it may sit in (none listed means only loose). A Software scheme's
  bugs never sit in an epic.
- Presets are seeded per user the first time their tasks are read, as
  goal categories are, and recorded in `task_user_settings`: workflows
  Checklist, Standard, Build, Bug, Parts and Epic; schemes Checklist,
  Standard, Software and Hardware. Users copy and edit them; a preset
  is an ordinary row once seeded.
- Every workflow has a system status **Missed** (category canceled) that
  only repeats set. Behaviour comes from the category, never the name:
  entering in progress stamps `started_at`; entering done or canceled
  stamps `closed_at` and unblocks dependants.
- **Gates** are chosen from a fixed set of kinds, never scripted:
  `field_required`, `link_required`, `checklist_complete`,
  `not_blocked`, `children_closed`, `confirm`. A gate sits on a move or on
  entering a status, is hard (409 with the gate's message) or soft (the
  move needs a reason, kept in `task_status_changes`). Preset gates are
  soft except `children_closed` on Epic → Done and `not_blocked` on
  entering In progress.
- Changing a type's workflow, or deleting a status, maps each affected
  task's status to the target workflow's first status in the same
  category; the operation takes an explicit mapping that overrides it.
- `tasks.status_id` references `task_workflow_statuses`, and a trigger
  keeps it within the workflow of the task's type in its project's
  scheme, so a bad write cannot leave a task in a foreign status.

### Status is stored; availability, urgency and signals are computed

- Stored: the status, its history (`task_status_changes`), and the dates
  people set.
- Computed on every read in pure functions under
  `minerva/tasks/engine/`, as goal progress is: effective dates (defer is
  the latest of task, milestone and project; due and deadline the
  earliest), availability (inactive, deferred, blocked, waiting,
  available, in that order of checks), urgency, epic progress and every
  signal. Nothing is cached, and no trigger cascades.
- **Planned dates roll by reading, not by a job.** `planned_on` is what
  you set and `first_planned_on` the first time it was set; an open task
  with `planned_on` before today is shown as planned today, rolled
  `today − planned_on` days. Re-planning writes `planned_on` and counts
  in `replan_count`. "Keeps rolling" and "Stale plan" read those columns
  and today; thresholds live in `task_user_settings`.
- **Urgency** orders lists by, in turn: a deadline within 2 days or past,
  the number of open tasks the task blocks, due date, priority, planned
  today, flagged, age.

### Dates are dates, with optional times

`defer_on`, `planned_on`, `due_on`, `deadline_on` are `date`, each with an
optional `time` column (`defer_at_time`…), and a planned block is
`planned_start` and `planned_end` (`time`). The caller's day comes from
`x-ncfritz-tz`, as goals' habit days do. Moving a deadline takes a
reason, recorded with the change.

### Repeats are a rule plus one row per occurrence

- `task_repeats`: one per repeating series; model (`fixed`,
  `after_completion`, `mark_missed`, `aggregate`, `stack`, `window`),
  schedule columns (frequency, interval, weekday mask, month day or Nth
  weekday, after-completion interval, active months for a window), lead
  days, end (count or date), paused. No RRULE strings.
- Every occurrence is its own `tasks` row with `repeat_id` and
  `occurrence_on`, unique together, so links, notes and history stay
  with the occurrence.
- Occurrences are made at two moments, both idempotent on
  `(repeat_id, occurrence_on)`: when an occurrence closes (fixed, after
  completion), and by `TaskRepeatScheduler`, an in-process sweep every 15
  minutes behind `TASKS_SCHEDULER_ENABLED` (on for one API per database),
  which opens due occurrences and closes left-behind ones as Missed or
  folds them for aggregate. A sweep after an outage catches up in one
  run.

### Links: typed where Olympus computes, generic otherwise

| Link                      | Table                                                | Why typed                            |
| ------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Task → goal (+ milestone) | `task_goals` (goals plan phase 9)                    | Goal progress and execution read it  |
| Project → goal            | `task_project_goals`                                 | Its tasks count for the goal         |
| Task blocked by task      | `task_dependencies`                                  | Availability and urgency read it     |
| Task related to task      | `task_relations` (related, split from, duplicate of) | Shown, and split keeps context       |
| Review item → task        | `review_items.task_id`                               | The item follows its task (ADR 0027) |
| Task → anything else      | `task_links` (`item_type`, `item_id`)                | —                                    |

- `task_links.item_type` is a closed, namespaced set under a `CHECK`
  (`minerva.meeting`, `minerva.note`, `minerva.mail_thread`,
  `minerva.calendar_event`, `harpocrates.certificate`, …). Adding one is
  a one-line migration. The service that deletes a linked thing removes
  its links.
- An epic linked to a goal counts all its tasks in the execution score.
- Notes link to tasks through `note_associations` with `item_type`
  `task`; no `task_notes` table.
- `GetTasksForEntity` (item type, item id) backs one site component, the
  Linked tasks panel, used on every page that shows linked tasks.

### Saved views use one small filter language

`task_views` stores a filter as text in a small language
(`due < +7d & category = Software & !blocked`), parsed and validated in
`minerva/tasks/filter/` into the Hasura `where` the services already
build, plus the computed predicates (availability, signals) applied
after the read. Quick search and embedded task lists use the same
language. A filter is a string the user wrote, not a document, so ADR
0007 holds; a filter that no longer parses is shown, not run.

### Focus modes

`task_focuses` and `task_focus_members` (categories and goal categories);
the active focus is on `task_user_settings` and applies to task views,
the Goals list, the review panels and Minerva Home. All, Personal and
Work are seeded. Goals gains a setting to hide categories with no goals.

### Every table follows ADR 0026's conventions

Closed sets are `text` with `CHECK`s and string enums in the model; every
table has `created_at` and `updated_at` with the
`set_minerva_<table>_updated_at` trigger, exposed as `createdTime` and
`lastUpdatedTime`; join tables are upserted so `created_at` survives.
Projects, folders and tasks are soft-deleted (`deleted_at`) with Restore.

## Consequences

- One tree carries both kinds of work, and the hierarchy is fixed at five
  named levels. Nobody can nest tasks, which is the point; a deep build
  uses components and epics instead.
- Workflows and schemes being rows makes the board, the editor and the
  gates one engine, at the cost of a seeding step per user and a trigger
  to keep statuses consistent.
- Availability, rolls, urgency and signals can never be stale, and every
  list pays to compute them. A user holds thousands of tasks, not
  millions; if a list grows slow, a SQL function in the pattern of the
  notes statistics comes next, not a cache.
- Repeats bring Tasks' first background work: one scheduler, off by
  default, enabled on one API per database.
- `task_links` gives Tasks a closed list of the things it can link to;
  every new kind is a migration, and other apps' deletes must clean up.
- Goals' phase 9 is unblocked by Tasks' phase 5; the reviews' "Track as
  task" by the same phase.
- The model gains many enums, so the enum snapshot changes in most
  phases.
