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

## Phase 1 — Reviews, prompts and answers — done 2026-10-02

1. **Shared helpers**: **done** — `localDates`, `validation` and
   `hasuraErrors` moved unchanged from `minerva/goals/utils` to
   `minerva/utils`, with Goals' imports and the date tests following, as
   their own commit before any review code.
2. **Migration** `1791000000000_minerva_reviews`: **done**
   - `minerva.review_user_settings`: `user_id` (primary key, cascade),
     `starter_prompts_at`, audit columns.
   - `minerva.reviews`: `id`, `user_id`, `kind` (`daily`, `weekly`),
     `period_start` (a Monday when weekly), `step` (default 1; 1 to 4
     daily, 1 to 5 weekly), the ratings `overall`, `mood`, `energy`,
     `focus`, `progress`, `balance` (1 to 5, nullable; mood, energy and
     focus null on a week, progress and balance null on a day),
     `completed_at`, audit columns. Unique `(user_id, kind,
period_start)`, and `(id, user_id, kind)` for the answers' key.
   - `minerva.review_prompts`: `id`, `user_id`, `kind`, `section`
     (`reflect`, `plan`), `label` (something besides whitespace, at most
     120), `placeholder` (at most 200), `position` (unique per user, kind
     and section, deferred so a reorder can pass through a collision),
     `archived_at`, audit columns.
   - `minerva.review_answers`: `id`, `review_id`, `prompt_id`, and the
     review's `user_id` and `kind` repeated, `body` (something besides
     whitespace, at most 10,000), audit columns. Unique `(review_id,
prompt_id)`. **Two composite foreign keys instead of a trigger**:
     `(review_id, user_id, kind)` to the review (cascade) and
     `(prompt_id, user_id, kind)` to the prompt (no action), so an answer
     can only be to a prompt of its review's user and kind, an answered
     prompt cannot be deleted, and deleting a user still removes
     everything in one statement.
   - Hasura: admin only, custom column names in camelCase; `answers` on
     reviews and prompts and `prompt` and `review` on answers are manual
     relationships, since the keys are composite.
3. **Starter prompts**: **done** — given the first time a user's prompts
   are read, once, after any the user already has in each section:

   | Kind   | Section | Prompts                                                                              |
   | ------ | ------- | ------------------------------------------------------------------------------------ |
   | Daily  | Reflect | What went well?; What didn’t go well?; What’s on my mind?; Anything else about today |
   | Daily  | Plan    | Thoughts for tomorrow                                                                |
   | Weekly | Reflect | Biggest win; What got in the way; What I learned; What to change next week           |
   | Weekly | Plan    | Theme for the week; Start; Stop                                                      |

   What’s on my mind?, Anything else about today, What I learned and What
   to change next week carry the canvas's placeholders.

4. **Operations**: **done** — thirteen, tags `Reviews` and
   `Review Prompts`. The prompts sit under `/reviews/` (as goal
   categories sit under `/goals/`), so no static route meets
   `/review/:reviewId`; `DescribeReviewPrompt` was added so a created
   prompt answers with a `Location` header.

   | Operation              | Route                                    |
   | ---------------------- | ---------------------------------------- |
   | `ListReviews`          | `GET /reviews`                           |
   | `CreateReview`         | `POST /reviews`                          |
   | `DescribeReview`       | `GET /review/:reviewId`                  |
   | `UpdateReview`         | `PUT /review/:reviewId`                  |
   | `CompleteReview`       | `POST /review/:reviewId/complete`        |
   | `DeleteReview`         | `DELETE /review/:reviewId`               |
   | `UpdateReviewAnswer`   | `PUT /review/:reviewId/answer/:promptId` |
   | `ListReviewPrompts`    | `GET /reviews/prompts`                   |
   | `CreateReviewPrompt`   | `POST /reviews/prompts`                  |
   | `ReorderReviewPrompts` | `PUT /reviews/prompts/order`             |
   | `DescribeReviewPrompt` | `GET /reviews/prompt/:promptId`          |
   | `UpdateReviewPrompt`   | `PUT /reviews/prompt/:promptId`          |
   | `DeleteReviewPrompt`   | `DELETE /reviews/prompt/:promptId`       |
   - `ListReviews` takes `kind`, `from` and `to` (period starts, at most
     400 days apart) and returns the reviews, oldest first, with their
     answers and `periodEnd`.
   - `CreateReview` takes `kind` and `period`: a day as `YYYY-MM-DD`; a
     week as `YYYY-Www` or its Monday. A period after the current one in
     the caller's timezone (`x-ncfritz-tz`) is a 400; one already
     reviewed is a 409. It answers with a `Location` header.
   - `UpdateReview` sets `step` and the ratings (1 to 5, or null to
     clear). A rating the kind does not take, or a step past its last, is
     a 400; a rating that would change on a completed review is a 409,
     while the step still moves; an empty body is a 304.
   - `CompleteReview` records the time once; again is a 304.
   - `UpdateReviewAnswer` trims the body and upserts it (an answer saved
     again keeps its row and created time); empty or only whitespace
     removes the answer and answers 204. A prompt of the other kind is a
     400, another user's review or prompt a 404. An answer written or
     changed after completion comes back `editedLater`.
   - `ListReviewPrompts` takes an optional `kind`. `ReorderReviewPrompts`
     takes `kind`, `section` and every prompt ID of that section.
     `DeleteReviewPrompt` on an answered prompt is a 409 (archive it).

5. **Tests**: **done** — `test/unit/minerva/reviews/` for the period
   rules (`utils/periods.ts`: days, ISO weeks with week 53, a week's
   Sunday, this week's Monday, which ratings each kind takes) and both
   converters; `test/api/minerva/reviews.spec.ts` and
   `reviewPrompts.spec.ts` (102 cases: no identity, another user's
   review and prompt, duplicates, the rating lock, the timezone deciding
   today, the starter set given once and racing, bad input before
   Hasura); `infra/hasura/tests/minerva_reviews.sql` for every
   constraint, both composite keys, the deferred positions, the upsert,
   audit times and cascades. Verified 2026-10-02 against a scratch
   PostgreSQL 16 with every migration applied, `down.sql` and `up.sql`
   run twice; and model, API, SDK and site build, lint, typecheck, test
   and pass the convention checks.

**Sign-off:** R1, R2 from the OpenAPI page against `hasura-dev` (the
migration and metadata applied there first): clean (Neil, 2026-10-02).

## Phase 2 — Plan items — built 2026-10-02, not signed off

1. **Migration** `1791010000000_minerva_review_items`: **done** —
   `minerva.review_items`: `id`, `user_id`, `review_id` (the review that
   planned the item or carried it there; with `user_id` a composite key
   to the review, cascade, for which `reviews` gains `unique (id,
user_id)`), `scope` (`day`, `week`), `period_start` (a Monday for a
   week), `kind` (`priority`, `todo`), `title` (something besides
   whitespace, at most 200), `position` (unique per user, scope, period
   and kind, deferred), `status` (`open`, `done`, `carried`, `someday`,
   `dropped`), `done_at` (set exactly when done), `carried_from_id`
   (set null when that item goes; unique, so an item is carried once),
   `carry_count` (stored at the carry: the chain's length even after an
   earlier link is deleted), `scheduled_on` (the item's day, or a day of
   its week), `scheduled_start` and `scheduled_end` (`time`; both or
   neither, start before end, only on a day), audit columns. Hasura:
   `items` on reviews; `review` and `carriedFrom` on items.
2. **Operations**: **done** — seven, tag `Review Items`.
   `DescribeReviewItem` was added for the `Location` of a planned or
   carried item, and the reorder moved under `/reviews/` with the period
   in its body, since a period's items can come from several reviews.

   | Operation            | Route                              |
   | -------------------- | ---------------------------------- |
   | `ListReviewItems`    | `GET /reviews/items`               |
   | `ReorderReviewItems` | `PUT /reviews/items/order`         |
   | `CreateReviewItem`   | `POST /review/:reviewId/items`     |
   | `DescribeReviewItem` | `GET /reviews/item/:itemId`        |
   | `UpdateReviewItem`   | `PUT /reviews/item/:itemId`        |
   | `CarryReviewItem`    | `POST /reviews/item/:itemId/carry` |
   | `DeleteReviewItem`   | `DELETE /reviews/item/:itemId`     |
   - `ListReviewItems` takes `scope`, `from` and `to` (period starts, at
     most 400 days apart) and returns every status: by period, priorities
     before to-dos, each in its order, with `carryCount`.
   - `CreateReviewItem` plans a priority or to-do for the period after
     the review's: a daily review plans the next day, a weekly review the
     next week; it goes last of its kind.
   - `UpdateReviewItem` changes the title, the status (open, done,
     someday, dropped; done records `doneTime`, anything else clears it;
     `carried` is refused, and a carried item's status is a 409), and the
     schedule, checked whole against the item's period (`HH:mm` times;
     clearing the day clears the block).
   - `ReorderReviewItems` takes `scope`, `periodStart`, `kind` and every
     item ID of that period and kind.
   - `CarryReviewItem` takes the carrying review's `reviewId` and an
     optional `scope`: the copy, open, last of its kind, is for the period
     after that review (Friday's review carries to Saturday, or with
     `week` to next week), counting one more carry. Only an open or
     someday item is carried (409 otherwise); a copy that would not be
     after the item's own period is a 400. The item is marked carried and
     the copy inserted in one transaction.
   - `DeleteReviewItem` removes an item; removing a carried copy undoes
     the carry, opening the item it came from again. Deleting a review
     removes the items it planned, and an item it carried in leaves its
     original marked carried.

3. **Tests**: **done** — the period after a review and an item's period
   end in `test/unit/minerva/reviews/utils/periods.spec.ts`, the
   converter (times as `HH:mm`); `test/api/minerva/reviewItems.spec.ts`
   (68 cases: planning from a day and a week, triage and `doneTime`,
   schedules on a day and across a week, the carry, its count, scope and
   refusals, undoing a carry, another user's review and item, bad input
   before Hasura); `infra/hasura/tests/minerva_review_items.sql` for
   every constraint, the one-copy rule, the deferred positions, audit
   times and cascades. Verified 2026-10-02 against the scratch
   PostgreSQL 16 (`down.sql` and `up.sql` both ways) and the Turbo tasks
   for model, API, SDK and site. The review specs now sign their token at
   the pinned clock, so they pass whatever day they run.

**Sign-off:** R3 from the OpenAPI page against `hasura-dev`.

## Phase 3 — The summary and pins — built 2026-10-02, not signed off

1. **Migration** `1791020000000_minerva_review_pins`: **done** —
   `minerva.review_pins`: `id`, `user_id`, `review_id`, `kind` (always
   `weekly`), `answer_id` or `note_id` (exactly one), audit columns.
   `(review_id, user_id, kind)` keys the review, so only a weekly review
   of the pin's user holds pins; `(answer_id, user_id)` keys the answer
   (cascade; `review_answers` gains `unique (id, user_id)`), so an answer
   is the pin's user's; `note_id` keys the note alone (cascade), since
   notes belong to no user yet. Unique per review and answer, and per
   review and note (partial indexes). Notes are soft-deleted, so a pin
   outlives a deleted note until it is purged. Hasura: `pins` on reviews;
   `answer`, `note` and `review` on pins.
2. **Operations**: **done** — four.

   | Operation          | Route                                 |
   | ------------------ | ------------------------------------- |
   | `GetReviewSummary` | `GET /reviews/summary`                |
   | `ListReviewPins`   | `GET /review/:reviewId/pins`          |
   | `CreateReviewPin`  | `POST /review/:reviewId/pins`         |
   | `DeleteReviewPin`  | `DELETE /review/:reviewId/pin/:pinId` |
   - `GetReviewSummary` takes `kind`, `from` and `to` (days, or the
     Mondays of the first and last weeks; at most 400 days) and
     `x-ncfritz-tz`, and reads the range and as many periods before it in
     one document. Per period: `status`, `current`, the review's ID,
     ratings and `headline`. **The statuses are refined** from the
     ADR's four to five: `complete`, `draft`, `missed` (past, no review),
     `open` (the current period, not reviewed yet) and `upcoming`, with
     `current` marking the period today falls in; the lists need "no
     review" apart from "not yet" and from the future. Then `averages`
     (completed reviews only, to two decimals: a review's ratings settle
     when it is completed) and `previousAverages`; `complete`, `drafts`
     and `due` (every period but the upcoming); `currentStreak` (from the
     current period when complete, else from the one before, so a day
     not reviewed yet does not break it; followed back up to 1,000
     periods) and `bestStreak` (within the range). The headline is the
     first non-empty line of the first answered Reflect prompt, in the
     prompts' order, cut to 140 characters.
   - `CreateReviewPin` takes `answerId` or `noteId`. A pin on a daily
     review, or an answer not from a daily review of the week, is a 400;
     another user's review or answer, or a missing note, a 404; pinning
     twice a 409. Pins have no route of their own, so no `Location`.
   - `ListReviewPins` returns a review's pins, oldest first;
     `DeleteReviewPin` unpins.

3. **Tests**: **done** — `summary/summary.ts` as pure functions in
   `test/unit/minerva/reviews/summary/summary.spec.ts` (week 39 from the
   canvas against week 38, statuses with today open and the rest
   upcoming, weeks, headlines across lines and prompts, averages leaving
   out drafts, streaks from yesterday, today and across a missed day);
   the pin converter; `reviewSummary.spec.ts` (today from two timezones
   either side of midnight) and `reviewPins.spec.ts` (the week's first
   and last days, the weeks either side, a daily review, notes);
   `infra/hasura/tests/minerva_review_pins.sql` for the keys, the
   one-of rule, duplicates, a soft-deleted and a purged note, audit
   times and cascades. Verified 2026-10-02 against the scratch
   PostgreSQL 16 and the Turbo tasks for model, API, SDK and site.

**Sign-off:** R4 from the OpenAPI page against `hasura-dev`.

## Phase 4 — The site: the daily review — built 2026-10-02, not signed off

Built as option B, guided steps, for both reviews (Neil, 2026-10-02):
the weekly review follows in phase 5 the same way. AntD's own components
in their standard style (`Steps`, `Card`, `Statistic`, `Radio.Group` as
buttons, `Descriptions`, `TimePicker.RangePicker`), Luxon for dates,
`@dnd-kit` for reordering as the goals drawers do, and a CSS module
(`Review.module.css`) rather than inline styles; geometry computed from
the data (the day bar's blocks) is the only inline style.

1. **`reviewsApi.ts`**: **done** — over the SDK, as `goalsApi`; calls
   that depend on today send the browser's timezone. Clearing an item's
   schedule sends `null`, which the generated types do not allow, so
   that one call (`unscheduleItem`) casts in one place.
2. **The daily review** at `/minerva/review/daily/yyyy/MM/dd`: **done**
   — `components/minerva/review/DailyReview.tsx` and its steps, the step
   in `?step=` (opening at the step asked, else the one reached, else the
   first), Back and Next, Save and exit to the list, Complete review on
   Wrap up. `useDailyReview` loads the day's review, the daily prompts,
   two days of calendar (`ListCalendarItems`), the day's notes
   (`ListNotesForDay`) and two days of items (`ListReviewItems`), and
   owns every change. **The review is started on the first thing saved**
   (a rating, an answer, a step moved on, an item planned or carried),
   not on opening the page; two saves at once start it once. A day that
   has not begun shows that instead of the steps.
   - **Look back**: the day in numbers (meeting time with overlaps
     counted once, notes with their types, planned items done of those
     kept), the day bar 7:00 to 22:00, the calendar and notes, and
     Today's plan: each item planned for the day decided Done, Tomorrow
     (carried by today's review; one marked done or dropped by mistake is
     opened first), Later (someday) or Drop. A carried item shows
     Tomorrow and no longer changes.
   - **Reflect**: Overall, Mood, Energy and Focus as 1 to 5 buttons with
     each end's words, disabled once the review is complete; the Reflect
     prompts (archived ones only where this review answered them), each
     saved when its box is left; the day's calendar and notes beside.
   - **Plan tomorrow**: tomorrow's calendar, day bar with blocked
     priorities drawn dashed, and its open time from 9:00 to 17:00
     (meetings and blocks both taken out); Top 3 and To-dos, each added,
     removed and dragged (or moved with the keyboard) into order, carried
     ones tagged; a priority given a block of time; the Plan prompts.
   - **Wrap up**: Today (ratings, answers, the record) and Tomorrow (Top
     3 with blocks, to-dos, plan answers), each with Edit to its step;
     completing sets the ratings, and a completed review says when.
     Goals do not appear yet: the goals panels in the reviews are the
     goals plan's phase 8.
3. **Tests**: **done** — `src/utils/reviews.ts` holds what the steps
   compute: the day's busy spans (all-day, deleted and free ones left
   out, clipped to the day), busy minutes with overlaps once, times and
   spans as the design writes them, the day bar's blocks, open time, note
   counts by type, a day's items in order, open and done-of-kept counts,
   each status's triage, the step to open and each kind's ratings,
   unit-tested in Seattle's zone in `test/unit/reviews.spec.ts`. The site
   builds (`next build`). The four steps were rendered with the canvas's
   sample data in a throwaway page and checked by screenshot, which
   caught a triage control showing Done chosen on open items and open
   time ignoring blocked priorities, both fixed.

**Sign-off:** R5 on the site, which needs phases 1 to 3's migrations on
`hasura-dev`.

## Phase 5 — The site: the weekly review — built 2026-10-02, not signed off

Guided steps, as the daily review (option B), with the same components
and CSS module; the step in `?step=`, Back and Next, Save and exit to the
weekly list, Complete review on Wrap up.

1. **The weekly review** at `/minerva/review/weekly/yyyy/Www`: **done** —
   `components/minerva/review/WeeklyReview.tsx` and its steps.
   `useWeeklyReview` loads the week's review and pins, the weekly and
   daily prompts, the daily summary of the week (`GetReviewSummary`, with
   last week's averages), the week's daily reviews (for their answers),
   twelve days of calendar (the week and next week's working days), the
   week's notes, the week's day items, and this week's and next week's
   week items. As the daily review does, it starts the review on the first
   thing saved; that start and the error messages are now shared
   (`reviewHooks.ts`). `reviewsApi` gains the pin calls. A week that has
   not begun shows that instead of the steps.
   - **Look back**: the seven day cards (status, overall rating,
     headline, a link to the day's review); a missed day takes a **quick
     score**, Overall 1 to 5, saved as that day's review completed with
     just the score, so it fills the chart's gap and counts in the
     averages; or Full review. The daily ratings chart (a line per rating,
     broken where a day has none) and each average against last week's;
     time (meetings and focus blocks per day, stacked); notes by type.
     **This week's priorities** and **Slipped this week**, each decided
     Done, Next week (carried by the weekly review with scope `week`),
     Someday or Drop. Slipped is each chain's last link in the week when
     it was carried at least once, **and anything left open on a day
     before today** (a day with no review leaves its items open; they
     slipped too). Goals wait for the goals plan's phase 8.
   - **Highlights**: the week's daily answers in columns by Reflect prompt
     (archived prompts only where answered), and the week's flagged notes;
     a pin button on each pins it to the week or unpins it.
   - **Reflect**: Overall, Progress and Balance; the weekly Reflect
     prompts; the pins in a rail beside them, each unpinnable.
   - **Plan next week**: a Monday-to-Friday grid, 8:00 to 18:00, of next
     week's meetings, each day's meeting count and time, and its load (the
     share of 9:00 to 17:00 taken by meetings and placed priorities,
     overlaps once: light, moderate, heavy). Priorities not yet placed
     wait in a strip; **dragged** (or moved with the keyboard) onto open
     time, one takes up to two hours of it from the quarter hour; dragged
     back to the strip it is unplaced. A placed one can also be put on a
     day and time from its row, without dragging. Priorities (three to
     five, reordered as the daily ones are), to-dos, what was carried in,
     and the Plan prompts (Theme for the week, Start, Stop).
   - **Wrap up**: This week (ratings, answers, pins, the record) and Next
     week (theme, start, stop, priorities with their places, to-dos),
     each with Edit; completing sets the ratings.
   - **Monday's daily review** opens Look back with **This week's plan**:
     the Plan answers of the week before's review and the week's
     priorities with their places (R6.4).
2. **Tests**: **done** — the week's arithmetic in `src/utils/reviews.ts`:
   a week's days, each day's meetings, focus blocks and load (all-day,
   free, dropped and carried left out; a meeting across midnight split
   between its days), the load levels, an item's block as a span,
   slipped items (chains in and out of the week, left open before today,
   the order), the weekly triage, the ratings chart's series with its
   gaps and a quick score filling one, averages against last week, the
   answers by prompt, and a dropped priority's block, unit-tested in
   Seattle's zone. The site builds and its Turbo tasks pass. The five
   steps were rendered with the canvas's week 39 in a throwaway page and
   checked by screenshot, including a priority dragged onto Tuesday's
   open time; that caught the day cards' quick score wrapping (now a
   select) and the averages truncating rather than rounding.

**Sign-off:** R6 on the site, which needs phases 1 to 3's migrations on
`hasura-dev`.

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
