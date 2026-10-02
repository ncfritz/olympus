import type {
  Meeting,
  Note,
  Review,
  ReviewItem,
  ReviewItemKind,
  ReviewPrompt,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { useCallback, useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import notesApi from "../../../api/notestApi";
import reviewsApi from "../../../api/reviewsApi";
import type { RatingField, Triage } from "../../../utils/reviews";
import { fail, useStartReview } from "./reviewHooks";

export type DailyReviewData = {
  loading: boolean;
  /** The day reviewed and the next, as YYYY-MM-DD. */
  day: string;
  tomorrow: string;
  /** Whether the day has begun where the user is; a later one cannot be reviewed. */
  started: boolean;
  /** The day's review, once one has been started. */
  review?: Review;
  prompts: ReviewPrompt[];
  /** The calendar of the day, and of the next. */
  meetings: Meeting[];
  tomorrowMeetings: Meeting[];
  notes: Note[];
  /** The items planned for the day and for the next. */
  items: ReviewItem[];
  /** On a Monday, the week as last week's review planned it. */
  week?: WeekPlan;
  setRating: (key: RatingField["key"], value: number | null) => Promise<void>;
  setStep: (step: number) => Promise<void>;
  saveAnswer: (promptId: string, body: string) => Promise<void>;
  triage: (item: ReviewItem, decision: Triage) => Promise<void>;
  addItem: (kind: ReviewItemKind, title: string) => Promise<void>;
  removeItem: (item: ReviewItem) => Promise<void>;
  reorderItems: (kind: ReviewItemKind, ids: string[]) => Promise<void>;
  blockItem: (
    item: ReviewItem,
    block: { start: string; end: string } | null,
  ) => Promise<void>;
  complete: () => Promise<boolean>;
};

/** A week as its weekly review planned it: the plan answers, the priorities. */
export type WeekPlan = {
  answers: { id: string; label: string; body: string }[];
  priorities: ReviewItem[];
};

/**
 * The week a Monday starts, as the week before's review planned it, or
 * undefined when nothing was planned for it.
 */
const weekPlanOf = async (monday: DateTime): Promise<WeekPlan | undefined> => {
  const day = monday.toISODate()!;
  const before = monday.minus({ weeks: 1 }).toISODate()!;
  const [reviews, prompts, items] = await Promise.all([
    reviewsApi.listReviews("weekly", before, before),
    reviewsApi.listPrompts("weekly"),
    reviewsApi.listItems("week", day, day),
  ]);
  const answers = prompts
    .filter((p) => p.section === "plan")
    .flatMap((prompt) => {
      const answer = reviews[0]?.answers.find((a) => a.promptId === prompt.id);
      return answer
        ? [{ id: answer.id, label: prompt.label, body: answer.body }]
        : [];
    });
  const priorities = items.filter(
    (i) => i.kind === "priority" && i.status !== "carried",
  );
  return answers.length || priorities.length
    ? { answers, priorities }
    : undefined;
};

/**
 * Everything a daily review shows and changes (ADR 0027): the day's review,
 * prompts, calendar, notes and plan items, read live from their features.
 * The review is started on the first thing saved, not on opening it.
 */
export const useDailyReview = (date: DateTime): DailyReviewData => {
  const day = date.toISODate()!;
  const tomorrow = date.plus({ days: 1 }).toISODate()!;
  const started = date.startOf("day") <= DateTime.now().startOf("day");

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Review>();
  const [prompts, setPrompts] = useState<ReviewPrompt[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tomorrowMeetings, setTomorrowMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [week, setWeek] = useState<WeekPlan>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reviews, p, calendar, n, i, w] = await Promise.all([
        reviewsApi.listReviews("daily", day, day),
        reviewsApi.listPrompts("daily"),
        meetingsApi.getMeetings(date.startOf("day"), 2),
        notesApi.getNotes(date.startOf("day").toUTC()),
        reviewsApi.listItems("day", day, tomorrow),
        // A Monday opens with the week its review planned.
        date.weekday === 1 ? weekPlanOf(date) : undefined,
      ]);
      setWeek(w);
      setReview(reviews[0]);
      setPrompts(p);
      const onDay = (m: Meeting, d: string) =>
        DateTime.fromISO(m.startTime).toISODate() === d;
      setMeetings(calendar.data.items.filter((m) => onDay(m, day)));
      setTomorrowMeetings(
        calendar.data.items.filter((m) => onDay(m, tomorrow)),
      );
      setNotes(n.data.notes.filter((note) => !note.deletedTime));
      setItems(i);
    } catch (error) {
      fail(error, "Could not load the day");
    } finally {
      setLoading(false);
    }
  }, [day, tomorrow]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The day's review, started now when there is none yet. */
  const ensureReview = useStartReview("daily", day, day, review, setReview);

  const refreshItems = async () => {
    setItems(await reviewsApi.listItems("day", day, tomorrow));
  };

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

  const saveAnswer = async (promptId: string, body: string) => {
    const existing = review?.answers.find((a) => a.promptId === promptId);
    if ((existing?.body ?? "") === body.trim()) return;
    try {
      const current = await ensureReview();
      const saved = await reviewsApi.saveAnswer(current.id, promptId, body);
      setReview((r) =>
        r
          ? {
              ...r,
              answers: [
                ...r.answers.filter((a) => a.promptId !== promptId),
                ...(saved ? [saved] : []),
              ],
            }
          : r,
      );
    } catch (error) {
      fail(error, "Could not save your answer");
    }
  };

  const triage = async (item: ReviewItem, decision: Triage) => {
    try {
      if (decision === "tomorrow") {
        const current = await ensureReview();
        // Only an open or someday item is carried: one marked done or
        // dropped by mistake is opened again first.
        if (item.status === "done" || item.status === "dropped") {
          await reviewsApi.updateItem(item.id, { status: "open" });
        }
        await reviewsApi.carryItem(item.id, current.id);
      } else {
        await reviewsApi.updateItem(item.id, {
          status:
            decision === "done"
              ? "done"
              : decision === "later"
                ? "someday"
                : "dropped",
        });
      }
      await refreshItems();
    } catch (error) {
      fail(error, "Could not save that");
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
    const before = items;
    setItems((all) =>
      all.map((i) =>
        i.periodStart === tomorrow && i.kind === kind && ids.includes(i.id)
          ? { ...i, position: ids.indexOf(i.id) }
          : i,
      ),
    );
    try {
      await reviewsApi.reorderItems("day", tomorrow, kind, ids);
      await refreshItems();
    } catch (error) {
      setItems(before);
      fail(error, "Could not save the new order");
    }
  };

  const blockItem = async (
    item: ReviewItem,
    block: { start: string; end: string } | null,
  ) => {
    try {
      if (block) {
        await reviewsApi.updateItem(item.id, {
          scheduledOn: item.periodStart,
          scheduledStart: block.start,
          scheduledEnd: block.end,
        });
      } else {
        await reviewsApi.unscheduleItem(item.id);
      }
      await refreshItems();
    } catch (error) {
      fail(error, "Could not block that time");
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
    day,
    tomorrow,
    started,
    review,
    prompts,
    meetings,
    tomorrowMeetings,
    notes,
    items,
    week,
    setRating,
    setStep,
    saveAnswer,
    triage,
    addItem,
    removeItem,
    reorderItems,
    blockItem,
    complete,
  };
};
