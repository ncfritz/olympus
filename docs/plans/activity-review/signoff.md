# Activity review: functional sign-off

One test plan per flow of
[ADR 0027](../../decisions/0027-minerva-activity-reviews.md) and the
[design](design.md), used to sign off each phase of the
[plan](README.md). Automated tests cover the rules; these checks prove the
flows on the real pieces: Hasura, the API, the site.

## Environments

| Id       | Where                                                    | Used from |
| -------- | -------------------------------------------------------- | --------- |
| **DEV**  | the API and site from the workspace against `hasura-dev` | phase 1   |
| **PROD** | the Mac Mini's `olympus` stack                           | phase 4   |

## Fixtures

| Fixture  | What                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| `user-a` | a signed-in user with week 39 (2026-09-21 to 27) reviewed as on the canvas: six days, Thursday missing |
| `user-b` | a second signed-in user with nothing                                                                   |
| `tz-utc` | requests sent with `x-ncfritz-tz: Etc/UTC` instead of `America/Los_Angeles`                            |

Every run records: date, environment, build (git commit), who ran it, and
per case pass/fail with the evidence named in the case. A phase is signed
off when every case listed for it passes, or a failure has an accepted,
recorded exception.

## R1 — Reviews and answers

1. `user-a` creates the daily review for 2026-10-01; creating it again is
   refused (409).
2. A weekly review for `2026-W40` starts on 2026-09-28; one given a
   Tuesday date is refused (400).
3. Overall 4 and Focus 2 are saved on the daily review; Progress on it is
   refused (400).
4. An answer saved twice keeps its `createdTime`; saving it empty removes
   it.
5. Completing the review records its time; changing a rating afterwards
   is refused (409) while an answer still saves and reads as edited
   later.
6. `user-b` gets 404 for `user-a`'s review and answers.
7. `infra/hasura/tests/minerva_reviews.sql` passes against `hasura-dev`'s
   database.

## R2 — Prompts

1. `user-b`'s first prompt list holds the starter prompts of both kinds,
   once; after deleting all unanswered ones, listing again gives none
   back.
2. A prompt with an answer cannot be deleted (409); archived, it leaves
   new reviews and stays on old ones.
3. Reordering the daily reflect prompts changes the order every daily
   review shows.

## R3 — Plan items

1. Planning tomorrow's Top 3 and two to-dos from 2026-10-01's review lists
   them for 2026-10-02.
2. Carrying a to-do twice gives a chain of three with a carry count of 2;
   carrying a done item is refused (409).
3. Done records `done_at`; Someday and Drop take the item off the next
   day's list.
4. A weekly priority scheduled Wednesday 9:00–11:00 reads back with its
   block; an end before its start is refused (400).

## R4 — Summary and pins

1. `GetReviewSummary` for week 39 gives six complete days, Thursday
   `none`, the averages drawn on the canvas, and last week's for the
   comparison.
2. On 2026-10-01 at 23:30 Pacific, today is 2026-10-01; with `tz-utc` it
   is 2026-10-02.
3. The streak counts back from today and stops at a missed day.
4. A weekly review pins a Wednesday answer and a flagged note; pinning an
   answer from another week is refused (400); deleting the note leaves
   the pin, shown as a deleted note, and restoring the note restores it.

## R5 — The daily review

1. Each step shows what the day's calendar and notes show in Meetings and
   Notes, and the numbers match.
2. Leaving at step 2 and returning opens step 2 with everything saved.
3. Left open's Tomorrow carries the item; it shows tagged on the next
   day's Top 3 or to-dos.
4. Completing locks the ratings in the page; Wrap up's Edit links reach
   the right step.
5. Every icon-only button has an accessible name; ratings are buttons
   with their number, not colour alone.

## R6 — The weekly review

1. The day cards and chart match the daily reviews; a missed day's quick
   score fills its gap in the chart.
2. Highlights groups every daily answer under its prompt; pins carry to
   Reflect and Wrap up.
3. A priority dragged onto Wednesday's open time reads back scheduled;
   the load per day matches Meetings.
4. Next week's theme and priorities show on Monday's daily review.

## R7 — The lists

1. Picking week 39 in the daily sider lists its seven days, newest first,
   Thursday as No review with Write review now.
2. Picking September in the weekly sider lists weeks 36 to 39; week 40
   lists under October.
3. Opening a row shows its reflection and record; opening another closes
   the first.
4. The day dots' colours match the overall ratings, and a missed day's
   dot is hollow.

## R8 — Minerva Home

1. Today's Top 3 and to-dos tick off from Home and show done in the next
   review's Look back.
2. Review today opens today's review, or continues the draft at its
   step.
