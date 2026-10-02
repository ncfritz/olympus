# Activity review: design

The screens for [ADR 0027](../../decisions/0027-minerva-activity-reviews.md),
drawn on the [design canvas](https://claude.ai/artifact/2o47YGRHejYLMZyM9zo8zy).
Names, numbers and answers on the canvas are sample data.

The site look is Minerva's: AntD light, the `#2c3c4a` header, the app
rail, the Minerva menu with breadcrumbs, and a 400 px right-hand sider.
The reviews sit under Review in the Minerva menu (Daily Review, Weekly
Review; Monthly Review stays without a route).

The canvas draws two layouts for each review, one page and guided steps.
**The guided steps were chosen** (Neil, 2026-10-01); the one-page boards
stay on the canvas for reference.

## Routes

| Route                              | Shows                                      |
| ---------------------------------- | ------------------------------------------ |
| `/minerva/review/daily`            | this week's daily list                     |
| `/minerva/review/daily/2026/W40`   | a week's daily list                        |
| `/minerva/review/daily/2026/10/01` | the daily review of a day (`?step=` 1–4)   |
| `/minerva/review/weekly`           | this month's weekly list                   |
| `/minerva/review/weekly/2026/10`   | a month's weekly list                      |
| `/minerva/review/weekly/2026/W40`  | the weekly review of a week (`?step=` 1–5) |

The menu's Daily Review opens today's review, Weekly Review this week's;
each review's title bar links to its list.

## Daily review

A stepper (Look back, Reflect, Plan tomorrow, Wrap up), Back and Next at
the foot, and Save and exit in the title bar. Every step saves as it
goes; the review is created on its first save, a draft until completed.

1. **Look back.** The day in numbers (meeting time and count, notes,
   items done, goals on track) over a day bar of the calendar; the
   calendar and the notes side by side; Left open: the day's open items,
   each triaged Done, Tomorrow, Later (someday) or Drop.
2. **Reflect.** The four ratings (Overall, Mood, Energy, Focus; 1–5)
   and the reflect prompts (starter set: What went well?, What didn't go
   well?, What's on my mind?, Anything else about today). A reference
   rail of the day's calendar and notes.
3. **Plan tomorrow.** Tomorrow's calendar as a time grid with its open
   time; Top 3 (priorities, reorderable, carried ones tagged); to-dos;
   goals to push; Thoughts for tomorrow (a plan prompt).
4. **Wrap up.** Today and Tomorrow summaries with Edit links, and a note
   that completing locks the ratings. Complete review.

## Weekly review

The same frame with five steps (Look back, Highlights, Reflect, Plan next
week, Wrap up).

1. **Look back.** Seven day cards (rating, headline, review status, a
   missed day linking to its review); a missed day's quick score (Overall
   1–5, or Full review); the daily ratings chart with the week's averages
   against last week's; time (meetings and focus blocks per day); notes
   by type; Slipped this week (items carried at least once, triaged Done,
   Next week, Someday, Drop); goals.
2. **Highlights.** The week's daily answers in three columns by prompt,
   and the week's flagged notes; a flag pins one to the week.
3. **Reflect.** The three ratings (Overall, Progress, Balance) and the
   reflect prompts (starter set: Biggest win, What got in the way, What I
   learned, What to change next week), beside the pinned highlights.
4. **Plan next week.** A Monday-to-Friday grid of next week's calendar
   with each day's meeting load; priorities (three to five) dragged onto
   open time; Theme for the week, Start and Stop (plan prompts); items
   carried in; goals for the week.
5. **Wrap up.** This week and next week summaries; completing locks the
   ratings, and next week's theme and priorities show on Monday's daily
   review and Minerva Home.

## Lists

A list of rows down the page and a calendar in the sider. One row is
open at a time.

- **Daily list.** A week's days, newest first, under a summary bar
  (days reviewed, averages, meetings, notes). A row: day and date,
  status (Complete, Draft, No review, Today), the four rating dots, the
  headline, meetings, notes and items done. Open: the reflection, the
  day's record (calendar, notes by type), what was planned for the day
  against what happened, and links to the review, the day's notes and
  Meetings. A missed day offers Write review now.
  The sider: a month calendar with an ISO week column; a week number
  selects the week; each day carries a dot coloured by its overall
  rating, hollow when not reviewed; the month's days reviewed, average
  and best streak.
- **Weekly list.** A month's weeks under a summary bar. A row: week and
  dates, status, the three rating dots, the seven days' overall dots,
  the headline, meetings, days reviewed and priorities done. Open: the
  numbers, the reflection, the pinned highlights, the priorities against
  what was done. A draft offers Continue review; a missed week, Write
  weekly review.
  The sider: a year grid of months with weeks reviewed, then the chosen
  month's calendar with its weeks marked.

## Not drawn yet

The prompt editor (Edit prompts), the Minerva Home panel for today's plan,
the goals panels (the goals plan's phase 8), the monthly review, and iOS
(sketched on the canvas as a Day, Reflect, Tomorrow switch, not designed).

## Decided

- Guided steps for both reviews (Neil, 2026-10-01).
- Lists with a calendar sider; days chosen by week, weeks by month; rows
  expand in place (Neil, 2026-10-01).
- The defaults in ADR 0027: answers as rows, ratings as columns, plan
  items as their own rows until Tasks, activity read live, ratings locked
  on completion, ISO weeks listed by their Thursday (Neil, 2026-10-01).
