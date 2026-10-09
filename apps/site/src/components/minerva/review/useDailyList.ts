import type {
  Meeting,
  Note,
  Review,
  ReviewItem,
  ReviewPrompt,
  ReviewSummary,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import reviewsApi from "../../../api/reviewsApi";
import { calendarWeeks } from "../../../utils/reviews";
import { fail } from "./reviewHooks";

export type DailyListData = {
  loading: boolean;
  /** The week's days as the summary has them, with last week's averages. */
  summary?: ReviewSummary;
  /** The week's reviews, for their answers. */
  reviews: Review[];
  prompts: ReviewPrompt[];
  meetings: Meeting[];
  notes: Note[];
  /** The items planned for the week's days. */
  items: ReviewItem[];
};

/**
 * A week's daily list: its days as the summary has them, their reviews,
 * meetings, notes and plan items.
 */
export const useDailyList = (monday: DateTime): DailyListData => {
  const from = monday.toISODate()!;
  const to = monday.plus({ days: 6 }).toISODate()!;
  const [data, setData] = useState<DailyListData>({
    loading: true,
    reviews: [],
    prompts: [],
    meetings: [],
    notes: [],
    items: [],
  });

  useEffect(() => {
    let current = true;
    setData((d) => ({ ...d, loading: true }));
    Promise.all([
      reviewsApi.getSummary("daily", from, to),
      reviewsApi.listReviews("daily", from, to),
      reviewsApi.listPrompts("daily"),
      meetingsApi.getMeetings(monday, 7),
      notesApi.getNotes(monday.toUTC(), 7),
      reviewsApi.listItems("day", from, to),
    ])
      .then(([summary, reviews, prompts, calendar, notes, items]) => {
        if (!current) return;
        setData({
          loading: false,
          summary,
          reviews,
          prompts,
          meetings: calendar.data.items.filter((m) => !m.isDeleted),
          notes: notes.data.notes.filter((n) => !n.deletedTime),
          items,
        });
      })
      .catch((error) => {
        if (!current) return;
        setData((d) => ({ ...d, loading: false }));
        fail(error, "Could not load the week");
      });
    return () => {
      current = false;
    };
  }, [from, to]);

  return data;
};

/**
 * A month's days as the summary has them, for the sider's calendar: every
 * day the calendar shows, from its first week's Monday to its last's Sunday.
 */
export const useMonthDays = (month: DateTime): ReviewSummary | undefined => {
  const weeks = calendarWeeks(month);
  const from = weeks[0].toISODate()!;
  const to = weeks[weeks.length - 1].plus({ days: 6 }).toISODate()!;
  const [summary, setSummary] = useState<ReviewSummary>();
  useEffect(() => {
    let current = true;
    reviewsApi
      .getSummary("daily", from, to)
      .then((s) => current && setSummary(s))
      .catch(() => current && setSummary(undefined));
    return () => {
      current = false;
    };
  }, [from, to]);
  return summary;
};
