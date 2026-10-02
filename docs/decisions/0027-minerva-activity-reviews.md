# 0027. Minerva reviews: per-user, what is written stored, activity read live

- **Status:** Accepted
- **Date:** 2026-10-01

## Context

Minerva gains a daily and a weekly review, drawn on the
[design canvas](https://claude.ai/artifact/2o47YGRHejYLMZyM9zo8zy) and
described in the [design](../plans/activity-review/design.md). In short:

- **Daily review**, four guided steps: Look back (the day's calendar,
  notes, tasks and goals; open items triaged), Reflect (four 1–5 ratings
  and prompts), Plan tomorrow (Top 3, to-dos, goals, thoughts) and Wrap up
  (a read-only summary; completing it).
- **Weekly review**, five steps: Look back (the seven days, rating trends,
  time, notes, slipped items, goals; a quick score for a missed day),
  Highlights (the week's daily answers by prompt and its flagged notes,
  pinned), Reflect (three ratings and prompts), Plan next week
  (priorities placed on days, theme, carried-in items, goals, start and
  stop) and Wrap up.
- **Lists** of past reviews: days by week, weeks by month, each row
  expanding to its detail, with a calendar sider.
- Later: an AI-written summary of a day or week, a monthly review, iOS,
  and to-dos promoted to tasks once Tasks exists.

What the repository already has, and lacks:

- Calendar items and notes are read for a range with `ListCalendarItems`
  and `ListNotesForDay`, and counted per day with `GetMeetingsSummary`
  and `GetNotesSummary`, both in the caller's timezone (`x-ncfritz-tz`).
  Their tables carry an `author`, not a user.
- Goals (ADR 0026) are per user and give today's goals
  (`ListGoalsForToday`), a day's habits (`ListGoalHabitsForDay`) and a
  week's execution (`GetGoalExecution`). Check-ins already carry the
  sources `daily_review` and `weekly_review`, and the goals plan's
  phase 8 waits on the reviews to add its panels.
- There is no Tasks feature yet. The Minerva menu already lists Daily,
  Weekly and Monthly Review, with no routes behind them.
- ADR 0007: relational schema only, no JSON documents in rows. Every
  table carries `created_at` and `updated_at`.

## Decision

### Reviews belong to Minerva and to a user

- The feature is `minerva/reviews` in the API and model, and
  `pages/minerva/review/` in the site. No new domain.
- Every table carries `user_id` (references `olympus.users`, cascade on
  delete). Every operation is `@RequiresIdentity()` and scoped to the
  caller; another user's review is a 404, as with goals.

### Store what is written; read what happened

A review stores only what its author writes or scores: ratings, prompt
answers, plan items and pins. What happened that day or week (calendar
items, notes, goals, counts) is read live from the features that own it,
by the site, through their existing operations. Nothing is copied into a
review, so a note edited later shows edited, and a review never
disagrees with the calendar.

The one exception is a period's rating summary for the trends, the lists
and their sider, which `GetReviewSummary` computes on read (below).

### The schema, in the `minerva` schema

| Table                  | Holds                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `reviews`              | kind (daily, weekly), period start, status, the step reached, the ratings, completed time                                        |
| `review_prompts`       | kind, section (reflect, plan), label, placeholder, position, archived                                                            |
| `review_answers`       | review, prompt, body; one per review and prompt                                                                                  |
| `review_items`         | the review it was planned in, scope (day, week), the period it is for, kind (priority, to-do), title, position, status, schedule |
| `review_pins`          | a weekly review's pinned highlights: a daily review's answer, or a note                                                          |
| `review_user_settings` | one per user: when the starter prompts were given                                                                                |

- **One `reviews` table for both kinds**, so answers, items and pins have
  one parent. A review is unique per user, kind and period start. A
  weekly review's period start is the Monday of its ISO week (a `CHECK`).
- **Ratings are columns**, `smallint` 1–5, nullable until scored:
  overall on both kinds; mood, energy and focus on daily; progress and
  balance on weekly. A `CHECK` keeps each kind's columns null on the
  other. The set is fixed; changing it is a migration.
- **Prompts are rows**, per user, given a starter set the first time a
  user's prompts are read (once, recorded in `review_user_settings`, as
  goal categories are). A prompt with answers is archived, not deleted,
  so old reviews keep their questions. An empty answer is no row.
- **Plan items are rows, not tasks.** An item records the review that
  planned it and the day or week it is for. Its status is open, done,
  carried, someday or dropped. Carrying an item marks it `carried` and
  creates its copy for the next period, linked by `carried_from_id`, so
  "moved four times" is the chain's length. A weekly priority may name a
  day and a time block (`scheduled_on`, `scheduled_start`,
  `scheduled_end`); the block is drawn in the review and on Minerva Home,
  and is not written to the calendar.
- **Pins** reference a `review_answers` row or a `minerva.notes` row,
  exactly one (a `CHECK`).
- Closed sets (kind, section, status, item kind, scope) are `text`
  columns with `CHECK` constraints and string enums in the model.
- Days and week starts are `date`, the caller's local day from
  `x-ncfritz-tz`, as goals' habit days are. Weeks are ISO, Monday to
  Sunday, matching the Meetings week URLs. A week is listed under the
  month its Thursday falls in.
- Every table carries the audit columns as in ADR 0026: `created_at`,
  `updated_at` with the `set_minerva_<table>_updated_at` trigger, exposed
  as `createdTime` and `lastUpdatedTime`. Answers saved again are upserts,
  so `created_at` survives.

### Completing a review locks its ratings

A review is a draft until completed. Completing records
`completed_time`; from then on its ratings refuse changes (409), so the
trends never move under you. Answers and items stay editable; an answer
whose `updated_at` is after `completed_time` is shown as edited later. A
missed day's quick score from the weekly Look back is a completed daily
review holding only its overall rating.

Reviews are hard-deleted, with their answers and pins. Items they planned
go with them; items carried out of them keep their copies.

### The summary is computed on read

`GetReviewSummary` (kind, a date range, `x-ncfritz-tz`) returns, per
period, the status (complete, draft, none, or today), the ratings and a
headline (the first line of the first reflect prompt's answer), plus the
range's averages, the same averages for the range before it, the count
reviewed and the current streak. A user writes a few hundred reviews a
year, so this is a small read; a SQL function in the pattern of the notes
statistics comes only if it grows slow.

### Goals and Tasks connect later, through their own plans

- The goals panels in the reviews (habits in Look back, the weekly
  check-in in Reflect, priorities from goals, a goal on an item) are the
  goals plan's phase 8, built on this feature. An item gains a nullable
  `goal_id` then.
- "Track as task" arrives with Tasks: an item gains a nullable `task_id`,
  and a tracked item's status follows its task.

## Consequences

- The reviews ship before Tasks and work alone: to-dos and priorities are
  review items until Tasks can take them.
- A review shows what the calendar and notes say now, not what they said
  when it was written; a deleted note leaves a pin that says so.
- Reviews are per user while notes and meetings are not, so Look back
  shows every note and meeting until those move to users, as goals
  already accepts.
- The rating set is fixed in the schema; a new rating is a migration and
  a model change, and the trends start empty for it.
- The model gains several enums, so the enum snapshot changes.
- No new configuration: no provider, secret or schedule. The AI summary,
  when it comes, is its own decision.
