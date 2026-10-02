import type {
  Meeting,
  Note,
  Review,
  ReviewItem,
  ReviewItemKind,
  ReviewPin,
  ReviewPrompt,
  ReviewSummary,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { useCallback, useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import reviewsApi from "../../../api/reviewsApi";
import type { RatingField, WeekTriage } from "../../../utils/reviews";
import {
  type AnswerActions,
  fail,
  useAnswerActions,
  useStartReview,
} from "./reviewHooks";
import { applyTriage } from "./triage";

export type WeeklyReviewData = AnswerActions & {
  loading: boolean;
  /** The week's Monday and Sunday, next week's Monday, and today, as YYYY-MM-DD. */
  monday: string;
  sunday: string;
  nextMonday: string;
  today: string;
  /** Whether the week has begun where the user is. */
  started: boolean;
  /** The week's review, once one has been started, and its pins. */
  review?: Review;
  pins: ReviewPin[];
  /** The weekly prompts, and the daily ones the week's answers are under. */
  prompts: ReviewPrompt[];
  dailyPrompts: ReviewPrompt[];
  /** The week's days as the daily summary has them, with last week's averages. */
  days?: ReviewSummary;
  /** The week's daily reviews, for their answers. */
  dailyReviews: Review[];
  /** The week's calendar and the next week's. */
  meetings: Meeting[];
  nextMeetings: Meeting[];
  notes: Note[];
  /** Items planned for the week's days. */
  dayItems: ItemList;
  /** Items planned for this week and for next week, as weeks. */
  weekItems: ItemList;
  setRating: (key: RatingField["key"], value: number | null) => Promise<void>;
  setStep: (step: number) => Promise<void>;
  quickScore: (day: string, overall: number) => Promise<void>;
  /** A decision on a planned item; null takes it back. */
  triage: (item: ReviewItem, decision: WeekTriage | null) => Promise<void>;
  pin: (target: { answerId: string } | { noteId: string }) => Promise<void>;
  unpin: (pin: ReviewPin) => Promise<void>;
  addItem: (kind: ReviewItemKind, title: string) => Promise<void>;
  removeItem: (item: ReviewItem) => Promise<void>;
  reorderItems: (kind: ReviewItemKind, ids: string[]) => Promise<void>;
  placeItem: (
    item: ReviewItem,
    place: { day: string; start: string; end: string } | null,
  ) => Promise<void>;
  complete: () => Promise<boolean>;
};

type ItemList = ReviewItem[];

/**
 * Everything a weekly review shows and changes (ADR 0027): the week's
 * review and pins, its days as the daily summary has them, the daily
 * reviews' answers, two weeks of calendar, the week's notes, and the
 * items planned for its days, for it and for the next. The review is
 * started on the first thing saved, as a daily one is.
 */
export const useWeeklyReview = (week: DateTime): WeeklyReviewData => {
  const start = week.startOf("week").startOf("day");
  const monday = start.toISODate()!;
  const sunday = start.plus({ days: 6 }).toISODate()!;
  const nextMonday = start.plus({ weeks: 1 }).toISODate()!;
  const today = DateTime.now().toISODate()!;
  const started = monday <= today;
  const period = `${start.toFormat("kkkk")}-W${start.toFormat("WW")}`;

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Review>();
  const [pins, setPins] = useState<ReviewPin[]>([]);
  const [prompts, setPrompts] = useState<ReviewPrompt[]>([]);
  const [dailyPrompts, setDailyPrompts] = useState<ReviewPrompt[]>([]);
  const [days, setDays] = useState<ReviewSummary>();
  const [dailyReviews, setDailyReviews] = useState<Review[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [nextMeetings, setNextMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dayItems, setDayItems] = useState<ReviewItem[]>([]);
  const [weekItems, setWeekItems] = useState<ReviewItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reviews, p, dp, summary, dailies, calendar, n, di, wi] =
        await Promise.all([
          reviewsApi.listReviews("weekly", monday, monday),
          reviewsApi.listPrompts("weekly"),
          reviewsApi.listPrompts("daily"),
          reviewsApi.getSummary("daily", monday, sunday),
          reviewsApi.listReviews("daily", monday, sunday),
          meetingsApi.getMeetings(start, 12),
          notesApi.getNotes(start.toUTC(), 7),
          reviewsApi.listItems("day", monday, sunday),
          reviewsApi.listItems("week", monday, nextMonday),
        ]);
      setReview(reviews[0]);
      setPins(reviews[0] ? await reviewsApi.listPins(reviews[0].id) : []);
      setPrompts(p);
      setDailyPrompts(dp);
      setDays(summary);
      setDailyReviews(dailies);
      const dayOf = (m: Meeting) => DateTime.fromISO(m.startTime).toISODate()!;
      setMeetings(calendar.data.items.filter((m) => dayOf(m) <= sunday));
      setNextMeetings(calendar.data.items.filter((m) => dayOf(m) > sunday));
      setNotes(n.data.notes.filter((note) => !note.deletedTime));
      setDayItems(di);
      setWeekItems(wi);
    } catch (error) {
      fail(error, "Could not load the week");
    } finally {
      setLoading(false);
    }
  }, [monday, sunday, nextMonday]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The week's review, started now when there is none yet. */
  const ensureReview = useStartReview(
    "weekly",
    period,
    monday,
    review,
    setReview,
  );

  const refreshItems = async () => {
    const [di, wi] = await Promise.all([
      reviewsApi.listItems("day", monday, sunday),
      reviewsApi.listItems("week", monday, nextMonday),
    ]);
    setDayItems(di);
    setWeekItems(wi);
  };

  const answerActions = useAnswerActions(
    review,
    setReview,
    ensureReview,
    refreshItems,
  );

  const setRating = async (key: RatingField["key"], value: number | null) => {
    try {
      const current = await ensureReview();
      const updated = await reviewsApi.updateReview(current.id, {
        [key]: value,
      });
      if (updated) setReview(updated);
    } catch (error) {
      fail(error, "Could not save the rating");
    }
  };

  const setStep = async (step: number) => {
    // Moving on records how far the review got; looking back does not.
    if (!review && step === 1) return;
    try {
      const current = await ensureReview();
      if (step > current.step) {
        const updated = await reviewsApi.updateReview(current.id, { step });
        if (updated) setReview(updated);
      }
    } catch (error) {
      fail(error, "Could not save your place");
    }
  };

  /**
   * A missed day scored in a click: its daily review, started if need be,
   * given an overall rating and completed, so it counts in the averages.
   */
  const quickScore = async (day: string, overall: number) => {
    try {
      const existing = dailyReviews.find((r) => r.periodStart === day);
      const daily = existing ?? (await reviewsApi.createReview("daily", day));
      await reviewsApi.updateReview(daily.id, { overall });
      await reviewsApi.completeReview(daily.id);
      const [summary, dailies] = await Promise.all([
        reviewsApi.getSummary("daily", monday, sunday),
        reviewsApi.listReviews("daily", monday, sunday),
      ]);
      setDays(summary);
      setDailyReviews(dailies);
    } catch (error) {
      fail(error, "Could not save the score");
    }
  };

  const triage = async (item: ReviewItem, decision: WeekTriage | null) => {
    try {
      await applyTriage(
        item,
        decision === "next" ? "carry" : decision,
        [...dayItems, ...weekItems],
        async () => {
          const current = await ensureReview();
          await reviewsApi.carryItem(item.id, current.id, "week");
        },
      );
      await refreshItems();
    } catch (error) {
      await refreshItems().catch(() => undefined);
      fail(error, "Could not save that");
    }
  };

  const pin = async (target: { answerId: string } | { noteId: string }) => {
    try {
      const current = await ensureReview();
      const created = await reviewsApi.createPin(current.id, target);
      setPins((all) => [...all, created]);
    } catch (error) {
      fail(error, "Could not pin that");
    }
  };

  const unpin = async (target: ReviewPin) => {
    try {
      await reviewsApi.deletePin(target.reviewId, target.id);
      setPins((all) => all.filter((p) => p.id !== target.id));
    } catch (error) {
      fail(error, "Could not unpin that");
    }
  };

  const addItem = async (kind: ReviewItemKind, title: string) => {
    try {
      const current = await ensureReview();
      await reviewsApi.createItem(current.id, kind, title);
      await refreshItems();
    } catch (error) {
      fail(error, "Could not add that");
    }
  };

  const removeItem = async (item: ReviewItem) => {
    try {
      await reviewsApi.deleteItem(item.id);
      await refreshItems();
    } catch (error) {
      fail(error, "Could not remove that");
    }
  };

  const reorderItems = async (kind: ReviewItemKind, ids: string[]) => {
    // Shown in the new order at once; put back if the save fails.
    const before = weekItems;
    setWeekItems((all) =>
      all.map((i) =>
        i.periodStart === nextMonday && i.kind === kind && ids.includes(i.id)
          ? { ...i, position: ids.indexOf(i.id) }
          : i,
      ),
    );
    try {
      await reviewsApi.reorderItems("week", nextMonday, kind, ids);
      await refreshItems();
    } catch (error) {
      setWeekItems(before);
      fail(error, "Could not save the new order");
    }
  };

  const placeItem = async (
    item: ReviewItem,
    place: { day: string; start: string; end: string } | null,
  ) => {
    // Shown in its place at once; put back if the save fails.
    const before = weekItems;
    setWeekItems((all) =>
      all.map((i) =>
        i.id === item.id
          ? {
              ...i,
              scheduledOn: place?.day,
              scheduledStart: place?.start,
              scheduledEnd: place?.end,
            }
          : i,
      ),
    );
    try {
      if (place) {
        await reviewsApi.updateItem(item.id, {
          scheduledOn: place.day,
          scheduledStart: place.start,
          scheduledEnd: place.end,
        });
      } else {
        await reviewsApi.unscheduleItem(item.id);
      }
      await refreshItems();
    } catch (error) {
      setWeekItems(before);
      fail(error, "Could not place that");
    }
  };

  const complete = async (): Promise<boolean> => {
    try {
      const current = await ensureReview();
      const updated = await reviewsApi.completeReview(current.id);
      if (updated) setReview(updated);
      return true;
    } catch (error) {
      fail(error, "Could not complete the review");
      return false;
    }
  };

  return {
    loading,
    monday,
    sunday,
    nextMonday,
    today,
    started,
    review,
    pins,
    prompts,
    dailyPrompts,
    days,
    dailyReviews,
    meetings,
    nextMeetings,
    notes,
    dayItems,
    weekItems,
    setRating,
    setStep,
    ...answerActions,
    quickScore,
    triage,
    pin,
    unpin,
    addItem,
    removeItem,
    reorderItems,
    placeItem,
    complete,
  };
};
