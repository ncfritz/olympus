# Activity review: phased implementation plan

The implementation of
[ADR 0027](../../decisions/0027-minerva-activity-reviews.md) and the
[design](design.md). Each phase ends in a working, deployable state and a
functional sign-off against [signoff.md](signoff.md).

| Phase | Delivers                                                                           | Depends on | Sign-off flows |
| ----- | ---------------------------------------------------------------------------------- | ---------- | -------------- |
| 0     | ADR accepted; empty feature in the model, API and site; the Review menu routes     | —          | —              |
| 1     | Reviews, prompts and answers: create, score, answer, complete; the starter prompts | 0          | R1, R2 (API)   |
| 2     | Plan items: priorities and to-dos, triage, carrying, scheduling                    | 1          | R3 (API)       |
| 3     | The summary and pins: `GetReviewSummary`, weekly highlights                        | 1, 2       | R4 (API)       |
| 4     | The site: the daily review, four steps                                             | 2          | R5             |
| 5     | The site: the weekly review, five steps                                            | 3, 4       | R6             |
| 6     | The site: the daily and weekly lists with their calendar siders                    | 3, 4       | R7             |
| 7     | Minerva Home: today's plan and the way into today's review                         | 4          | R8             |
| Later | Prompt editor; monthly review; AI summary; iOS; Tasks; time blocks on the calendar |            |                |

Phases 5 and 6 can run in either order once phase 4 is in. The goals
panels in the reviews are the [goals plan](../goals/README.md)'s phase 8,
built after phase 5 here.

## Where the code goes

| What         | Where                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model shapes | `packages/model/src/minerva/reviews/`: `reviews.ts`, `prompts.ts`, `answers.ts`, `items.ts`, `pins.ts`, `summary.ts`, `index.ts`                                             |
| API          | `apps/api/src/minerva/reviews/`: `ReviewsModule`, `controllers/`, `services/`, `converters/`, `queries/`, `summary/` (pure functions)                                        |
| Schema       | `infra/hasura/migrations/olympus/<ts>_minerva_review*`, with metadata (custom camelCase column names, as every table); tests in `infra/hasura/tests/`                        |
| Site         | `apps/site/src/pages/minerva/review/`, `src/components/minerva/review/`, `src/api/reviewsApi.ts`, `src/utils/reviews.ts`, the routes in `components/minerva/layout/menu.tsx` |

The operations follow `docs/conventions/api.md` and start from
`pnpm gen api-operation`. Controllers are thin; the services own the
Hasura documents; `summary/` owns every rule about statuses, averages,
headlines and streaks and does no I/O. Every operation is
`@RequiresIdentity()`, takes the caller with `requireUser(principal)` and
passes `user.userId` to the service, which scopes every query by it.
Local days come from `x-ncfritz-tz` through the helpers in
`minerva/goals/utils/localDates.ts`, moved to a shared Minerva utility in
phase 1 rather than copied.

Every table below has the audit columns: `created_at` and `updated_at`
(`timestamp with time zone`, not null, default `now()`), the
`set_minerva_<table>_updated_at` trigger on
`minerva.set_current_timestamp_updated_at()`, and the custom names
`createdTime` and `lastUpdatedTime` in the metadata. Each phase's
migration test checks that an update moves `updated_at` and leaves
`created_at`.

No new configuration: the feature has no provider, secret or schedule.

## Phase 0 — Decision and scaffolding — done 2026-10-02

1. **ADR 0027 accepted**: **done** 2026-10-01.
2. **Model**: **done** — `minerva/reviews/index.ts`, exported up to
   `src/index.ts`; no shapes yet.
3. **API**: **done** — `ReviewsModule` in `MINERVA_MODULES`, no
   operations.
4. **Site**: **done** — the menu's Daily Review and Weekly Review open
   today's review and this week's
   (`pages/minerva/review/daily/[[...date]].tsx` and
   `pages/minerva/review/weekly/[[...date]].tsx`), and the menu selects
   them for every route in the design's table. Each page shows its
   breadcrumbs and an empty state naming the day, week or month the
   route asks for; an address that is no review says so. Monthly Review
   is disabled until it has a route.
5. **Routes**: **done** — `src/utils/reviews.ts` reads and writes the
   design's routes (ISO weeks with their week-year, so week 53 of 2026
   is reached from 2027-01-01; a week listed under its Thursday's
   month), unit-tested in `test/unit/reviews.spec.ts`.

**Sign-off:** the API boots, both menu entries open their pages, and the
Turbo tasks pass. Verified 2026-10-02 from a clean install: build, lint,
test, typecheck and the convention checks pass for the model, API and
site (the site built with placeholder `NEXT_PUBLIC_*` values). Opening
the pages in a browser is Neil's to check.

## Phase 1 — Reviews, prompts and answers

1. **Migration** `1791000000000_minerva_reviews`:
   - `minerva.review_user_settings`: `user_id` (primary key, cascade),
     `starter_prompts_at`, audit columns.
   - `minerva.reviews`: `id`, `user_id`, `kind` (`daily`, `weekly`),
     `period_start` (date; a Monday when weekly), `step` (1 to 5; 4 at
     most when daily), the ratings `overall`, `mood`, `energy`, `focus`,
     `progress`, `balance` (1 to 5, nullable; mood, energy and focus null
     when weekly, progress and balance null when daily), `completed_at`
     (nullable), audit columns. Unique `(user_id, kind, period_start)`.
   - `minerva.review_prompts`: `id`, `user_id`, `kind`, `section`
     (`reflect`, `plan`), `label` (1 to 120, not blank), `placeholder`
     (optional), `position`, `archived`, audit columns.
   - `minerva.review_answers`: `id`, `review_id` (cascade), `prompt_id`
     (restrict), `body` (not blank), audit columns. Unique
     `(review_id, prompt_id)`; a trigger refuses a prompt of the other
     kind or of another user.
     Hasura: admin only, custom column names in camelCase.
2. **Starter prompts**, given the first time a user's prompts are read:

   | Kind   | Section | Prompts                                                                              |
   | ------ | ------- | ------------------------------------------------------------------------------------ |
   | Daily  | Reflect | What went well?; What didn't go well?; What's on my mind?; Anything else about today |
   | Daily  | Plan    | Thoughts for tomorrow                                                                |
   | Weekly | Reflect | Biggest win; What got in the way; What I learned; What to change next week           |
   | Weekly | Plan    | Theme for the week; Start; Stop                                                      |

3. **Operations**, tag `Reviews`:

   | Operation              | Route                                    |
   | ---------------------- | ---------------------------------------- |
   | `ListReviews`          | `GET /reviews`                           |
   | `CreateReview`         | `POST /reviews`                          |
   | `DescribeReview`       | `GET /review/:reviewId`                  |
   | `UpdateReview`         | `PUT /review/:reviewId`                  |
   | `CompleteReview`       | `POST /review/:reviewId/complete`        |
   | `DeleteReview`         | `DELETE /review/:reviewId`               |
   | `UpdateReviewAnswer`   | `PUT /review/:reviewId/answer/:promptId` |
   | `ListReviewPrompts`    | `GET /review/prompts`                    |
   | `CreateReviewPrompt`   | `POST /review/prompts`                   |
   | `UpdateReviewPrompt`   | `PUT /review/prompt/:promptId`           |
   | `ReorderReviewPrompts` | `PUT /review/prompts/order`              |
   | `DeleteReviewPrompt`   | `DELETE /review/prompt/:promptId`        |

   `ListReviews` takes `kind`, `from` and `to` (dates) and returns the
   reviews in the range with their answers. `CreateReview` takes the
   kind and the period (a day, or an ISO week `YYYY-Www`); a second one
   for the same period is a 409, a week not starting Monday a 400.
   `UpdateReview` sets the step and the ratings; a rating changed on a
   completed review is a 409, a rating of the other kind a 400.
   `CompleteReview` records the time once; again is a 304.
   `UpdateReviewAnswer` upserts the answer, and an empty body deletes it.
   `DeleteReviewPrompt` on an answered prompt is a 409 (archive it).
   The static `/review/prompts` routes register before `/review/:reviewId`.

4. **Tests**: converter units; endpoint tests including another user's
   review and prompt (404), no identity (401), duplicates (409), the
   rating lock (409) and bad input (400, before Hasura);
   `infra/hasura/tests/minerva_reviews.sql` for the constraints, the
   kind checks, audit times and cascades, with `down.sql` exercised.

**Sign-off:** R1, R2 from the OpenAPI page.

## Phase 2 — Plan items

1. **Migration** `1791010000000_minerva_review_items`:
   `minerva.review_items`: `id`, `user_id`, `review_id` (the review it
   was planned in, cascade), `scope` (`day`, `week`), `period_start`
   (the day, or the Monday, it is for), `kind` (`priority`, `todo`),
   `title` (1 to 200, not blank), `position`, `status` (`open`, `done`,
   `carried`, `someday`, `dropped`), `done_at`, `carried_from_id`
   (references `review_items`, set null), `scheduled_on` (a day in the
   week, weekly only), `scheduled_start` and `scheduled_end` (times,
   both or neither, start before end), audit columns.
2. **Operations**:

   | Operation            | Route                               |
   | -------------------- | ----------------------------------- |
   | `ListReviewItems`    | `GET /review/items`                 |
   | `CreateReviewItem`   | `POST /review/:reviewId/items`      |
   | `UpdateReviewItem`   | `PUT /review/item/:itemId`          |
   | `ReorderReviewItems` | `PUT /review/:reviewId/items/order` |
   | `CarryReviewItem`    | `POST /review/item/:itemId/carry`   |
   | `DeleteReviewItem`   | `DELETE /review/item/:itemId`       |

   `ListReviewItems` takes `scope`, `from` and `to` and returns the items
   for those periods with their carry count. `CreateReviewItem` creates
   an item for the period after the review's (tomorrow, next week).
   `UpdateReviewItem` changes the title, status (done records
   `done_at`), schedule and position. `CarryReviewItem` marks the item
   `carried` and creates its copy for the next period, returning it with
   a `Location` header; carrying a done, dropped or carried item is a 409.

3. **Tests**: as phase 1, plus the carry chain and its count, and
   `infra/hasura/tests/minerva_review_items.sql`.

**Sign-off:** R3 from the OpenAPI page.

## Phase 3 — The summary and pins

1. **Migration** `1791020000000_minerva_review_pins`:
   `minerva.review_pins`: `id`, `review_id` (a weekly review, cascade),
   `answer_id` (references `review_answers`, cascade) or `note_id`
   (references `minerva.notes`, cascade), exactly one, audit columns.
   Unique per review and target.
2. **Operations**:

   | Operation          | Route                                 |
   | ------------------ | ------------------------------------- |
   | `GetReviewSummary` | `GET /reviews/summary`                |
   | `ListReviewPins`   | `GET /review/:reviewId/pins`          |
   | `CreateReviewPin`  | `POST /review/:reviewId/pins`         |
   | `DeleteReviewPin`  | `DELETE /review/:reviewId/pin/:pinId` |

   `GetReviewSummary` takes `kind`, `from`, `to` and `x-ncfritz-tz` and
   returns, per period, the status (`complete`, `draft`, `none`,
   `today`), the ratings and the headline; the range's averages and the
   previous range's; how many were reviewed; and the current and best
   streaks. A pin on a daily review, or to an answer outside the weekly
   review's week, is a 400.

3. **Tests**: `summary/` as pure functions (statuses across a day
   boundary in two timezones, averages over partly rated ranges, streaks
   broken by a missed day, headlines from multi-line answers); endpoint
   tests as before; `infra/hasura/tests/minerva_review_pins.sql`.

**Sign-off:** R4 from the OpenAPI page.

## Phase 4 — The site: the daily review

Built with AntD's own components in their standard style (`Steps`,
`Rate`-style button groups as drawn, `Card`, `List`, `Segmented`), Luxon
for dates, and the existing FullCalendar for the time grid.

1. **`reviewsApi.ts`** over the SDK; every call that depends on today
   sends the browser's timezone.
2. **The daily review** at `/minerva/review/daily/yyyy/MM/dd`, the step
   in `?step=`: Look back (numbers, day bar, calendar, notes, Left open
   with its triage), Reflect (ratings, prompts, reference rail), Plan
   tomorrow (time grid, Top 3, to-dos, thoughts), Wrap up (summaries,
   Complete review). The calendar and notes come from `ListCalendarItems`,
   `ListNotesForDay`, `GetMeetingsSummary` and `GetNotesSummary`; the
   review is created on its first save.
3. **Tests**: `src/utils/reviews.ts` holds the words, order and
   arithmetic the steps draw (the day's numbers, the day bar's blocks,
   open time, which items are left open, the summaries), with unit tests
   in `test/unit/reviews.spec.ts`. The site builds.

**Sign-off:** R5 on the site.

## Phase 5 — The site: the weekly review

1. **The weekly review** at `/minerva/review/weekly/yyyy/Www`: Look back
   (day cards, quick score, ratings chart against last week, time, notes
   by type, Slipped this week with its triage), Highlights (answers by
   prompt, flagged notes, pins), Reflect (ratings, prompts, pinned rail),
   Plan next week (week grid with load, priorities placed by drag, theme,
   start, stop, carried in), Wrap up.
2. **Tests**: the week's arithmetic (load per day, slipped items, the
   chart's series and gaps) in `src/utils/reviews.ts`, unit-tested.

**Sign-off:** R6 on the site.

## Phase 6 — The site: the lists

1. **Daily list** at `/minerva/review/daily` and `.../yyyy/Www`, and
   **weekly list** at `/minerva/review/weekly` and `.../yyyy/MM`, from
   `GetReviewSummary` and `ListReviews`, with the counts from the
   meetings and notes summaries. Rows expand in place, one at a time.
2. **The siders**: the month calendar with its week column and rating
   dots (daily), the year grid and the month's weeks (weekly).
3. **Tests**: the calendar geometry (weeks of a month, a week's month by
   its Thursday) and row contents, unit-tested.

**Sign-off:** R7 on the site.

## Phase 7 — Minerva Home

A panel on Minerva Home for today: the Top 3 and to-dos planned for
today (ticked off in place), this week's theme and priorities, and
Review today (Continue when a draft exists). Drawn before it is built.

**Sign-off:** R8.

## Later

- The prompt editor (Edit prompts): the API is there from phase 1.
- A monthly review in the same pattern, behind the existing menu entry.
- An AI-written summary of a day or a week: its own decision.
- iOS: the daily review as a Day, Reflect, Tomorrow switch.
- Tasks: an item gains `task_id`; Track as task promotes it.
- Time blocks written to the calendar, once the calendar sync can write.
