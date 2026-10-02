import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import {
  blockedSpan,
  formatSpan,
  itemsOf,
  type MeetingSpan,
  meetingSpans,
  openTime,
} from "../../../utils/reviews";
import type { CalendarBlock } from "./DayCalendar";
import type { DailyReviewData } from "./useDailyReview";

export type TomorrowPlan = {
  priorities: ReviewItem[];
  todos: ReviewItem[];
  /** The items still planned: not dropped, not carried on. */
  planned: ReviewItem[];
  /** The time they have blocked, as the calendar draws it. */
  blocks: CalendarBlock[];
  /** Tomorrow's open time, less its meetings and blocks, as a line. */
  openLine: string;
};

/**
 * Tomorrow as the review plans it: its priorities and to-dos, the time
 * they have blocked, and the open time left between 9:00 and 5:00.
 */
export const tomorrowPlan = (
  data: Pick<DailyReviewData, "items" | "tomorrow" | "tomorrowMeetings">,
): TomorrowPlan => {
  const date = DateTime.fromISO(data.tomorrow);
  const priorities = itemsOf(data.items, data.tomorrow, "priority");
  const todos = itemsOf(data.items, data.tomorrow, "todo");
  const planned = [...priorities, ...todos].filter(
    (i) => i.status !== "dropped" && i.status !== "carried",
  );
  const blocked = planned
    .map((item) => {
      const span = blockedSpan(item);
      return span ? { item, span } : undefined;
    })
    .filter((b): b is { item: ReviewItem; span: MeetingSpan } => !!b);
  // Time already blocked is not open any more.
  const open = openTime(
    [
      ...meetingSpans(data.tomorrowMeetings, date),
      ...blocked.map((b) => b.span),
    ].sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    date,
  );
  return {
    priorities,
    todos,
    planned,
    blocks: blocked.map(({ item, span }) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      start: span.start.toJSDate(),
      end: span.end.toJSDate(),
    })),
    openLine: open.length
      ? `Open: ${open.map((g) => formatSpan(g.start, g.end)).join(" · ")}`
      : "No open time between 9:00 and 5:00 PM.",
  };
};
