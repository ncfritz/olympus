# Goals: design

The screens for [ADR 0026](../../decisions/0026-minerva-goals.md), drawn
on the [design canvas](https://claude.ai/artifact/WoB7NbaTpC3jXt7zWiuAM3).
The feature set behind them is the
[Goals core feature set](https://claude.ai/code/artifact/fe0e780b-d635-474a-9c97-36b31f229092).
Goals, numbers and vision lines on the canvas are sample data.

The site look is the reviews': AntD light, the `#2c3c4a` header, the app
rail, the Minerva menu with breadcrumbs, and a 400 px right-hand sider.
Goals has its own entry in the Minerva menu, between Tasks and Review.

## Goals home

Three views of one page, switched in the title bar (Board, Roadmap,
Focus), over shared filters (horizon: all active, the year, the quarter,
the cycle, ongoing; tags; status) and a summary strip (active count, by
health, this week's execution against 85 %, the cycle's week).

- **Board.** One card per category: its colour, name and vision line,
  then its goals with type icon, title, health, a progress bar with a tick
  where pace says it should be, the metric in words and the due date.
  Sub-goals sit indented under their parent. "Add goal to <category>" at
  the foot.
- **Roadmap.** The year as a timeline: quarter and 12-week cycle bands
  side by side (the buffer week hatched), a lane per category, each goal a
  bar from start to due date filled to its progress, habits as dashed
  ongoing lines, achievements as a diamond on their date, and a today
  line.
- **Focus.** The current cycle (week of twelve, this week's and the
  cycle's execution), then goals ranked off track first, each with a
  Check in button. A goal flagged by the at-risk streak carries a banner:
  Replan, Push due date, Drop. The sider holds today's habits, the week's
  done-against-planned bars and what is due next.

## Goal page

Header: type icon, title, health, the why line, category, type, horizon
and dates, status, tags; Edit, more actions and Check in.

Under it, by type:

| Type        | Panel                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome     | Numbers (current, where pace says, projection at the current rate, rate needed, execution); chart of check-ins, pace band, projection |
| Milestone   | Progress against pace; the ordered checklist with dates and linked-task counts; the next milestone emphasised                         |
| Habit       | Adherence, current and best streak; a 12-week grid (weekday × week) with per-week counts; today's log button                          |
| Achievement | A done toggle and days left; check-ins; the close-out on marking it achieved or passing the due date                                  |

Then sub-goals (with adherence or progress and health), linked tasks
(from phase 9) and linked notes. The sider holds the check-in form
(value, three confidence buttons with pace's suggestion selected, note)
and the check-in history with each entry's source.

## Not drawn yet

New goal (one adaptive form or guided steps), the category page, the
check-in modal on its own, the review panels (daily habits, the weekly
check-in in Reflect), iOS.

## Open

1. Which home view ships first, and whether all three ship as views of one
   page (as drawn) or one is chosen.
2. New goal: one adaptive form or guided steps.
3. Whether Focus's ranking should weigh the due date as well as health.
