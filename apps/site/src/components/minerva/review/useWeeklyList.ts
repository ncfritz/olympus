import type {
  Meeting,
  Note,
  Review,
  ReviewItem,
  ReviewPin,
  ReviewPrompt,
  ReviewSummary,
} from "@ncfritz/olympus-sdk/minerva";
import type { DateTime } from "luxon";
import { useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import reviewsApi from "../../../api/reviewsApi";
import { weeksOfMonth } from "../../../utils/reviews";
import { fail } from "./reviewHooks";

export type WeeklyListData = {
  loading: boolean;
  /** The Mondays of the weeks the month lists. */
  weeks: DateTime[];
  /** The weeks as the weekly summary has them, and their days as the daily. */
  summary?: ReviewSummary;
  days?: ReviewSummary;
  reviews: Review[];
  dailyReviews: Review[];
  prompts: ReviewPrompt[];
  dailyPrompts: ReviewPrompt[];
  /** Each weekly review's pins, by its id. */
  pins: Map<string, ReviewPin[]>;
  meetings: Meeting[];
  notes: Note[];
  /** The weeks' priorities and to-dos. */
  items: ReviewItem[];
};

/**
 * A month's weekly list: its weeks (those whose Thursday is in it) as the
 * weekly summary has them, their days, reviews, pins, meetings, notes and
 * plan items.
 */
export const useWeeklyList = (month: DateTime): WeeklyListData => {
  const weeks = weeksOfMonth(month);
  const from = weeks[0].toISODate()!;
  const lastMonday = weeks[weeks.length - 1].toISODate()!;
  const lastSunday = weeks[weeks.length - 1].plus({ days: 6 }).toISODate()!;
  const [data, setData] = useState<WeeklyListData>({
    loading: true,
    weeks,
    reviews: [],
    dailyReviews: [],
    prompts: [],
    dailyPrompts: [],
    pins: new Map(),
    meetings: [],
    notes: [],
    items: [],
  });

  useEffect(() => {
    let current = true;
    setData((d) => ({ ...d, loading: true }));
    const span = weeks.length * 7;
    (async () => {
      const [
        summary,
        days,
        reviews,
        dailyReviews,
        prompts,
        dailyPrompts,
        calendar,
        notes,
        items,
      ] = await Promise.all([
        reviewsApi.getSummary("weekly", from, lastMonday),
        reviewsApi.getSummary("daily", from, lastSunday),
        reviewsApi.listReviews("weekly", from, lastMonday),
        reviewsApi.listReviews("daily", from, lastSunday),
        reviewsApi.listPrompts("weekly"),
        reviewsApi.listPrompts("daily"),
        meetingsApi.getMeetings(weeks[0], span),
        notesApi.getNotes(weeks[0].toUTC(), span),
        reviewsApi.listItems("week", from, lastMonday),
      ]);
      const pins = new Map(
        await Promise.all(
          reviews.map(
            async (r) => [r.id, await reviewsApi.listPins(r.id)] as const,
          ),
        ),
      );
      return {
        loading: false,
        weeks,
        summary,
        days,
        reviews,
        dailyReviews,
        prompts,
        dailyPrompts,
        pins,
        meetings: calendar.data.items.filter((m) => !m.isDeleted),
        notes: notes.data.notes.filter((n) => !n.deletedTime),
        items,
      };
    })()
      .then((loaded) => current && setData(loaded))
      .catch((error) => {
        if (!current) return;
        setData((d) => ({ ...d, loading: false }));
        fail(error, "Could not load the month");
      });
    return () => {
      current = false;
    };
  }, [from, lastMonday, lastSunday]);

  return data;
};

/**
 * A year's weeks as the weekly summary has them, for the sider's year
 * grid: from the first week January lists to the last December does.
 */
export const useYearWeeks = (year: number, first: DateTime, last: DateTime) => {
  const from = first.toISODate()!;
  const to = last.toISODate()!;
  const [summary, setSummary] = useState<ReviewSummary>();
  useEffect(() => {
    let current = true;
    reviewsApi
      .getSummary("weekly", from, to)
      .then((s) => current && setSummary(s))
      .catch(() => current && setSummary(undefined));
    return () => {
      current = false;
    };
  }, [year, from, to]);
  return summary;
};
