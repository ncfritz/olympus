import type { ReviewPin } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";
import { config } from "../../../utils/notes";
import { firstLine } from "./NoteList";
import type { WeeklyReviewData } from "./useWeeklyReview";

/** A pin as the steps show it: where it came from and what it says. */
export type PinnedHighlight = {
  pin: ReviewPin;
  /** The day it was written on, YYYY-MM-DD. */
  day?: string;
  /** The prompt it answered, or the note's type. */
  source: string;
  text: string;
};

/**
 * The review's pins with what they hold, from the week's daily answers and
 * notes already loaded; a pin whose note has gone is left out.
 */
export const pinnedHighlights = (data: WeeklyReviewData): PinnedHighlight[] =>
  data.pins.flatMap((pin): PinnedHighlight[] => {
    if (pin.answerId) {
      for (const review of data.dailyReviews) {
        const answer = review.answers.find((a) => a.id === pin.answerId);
        if (answer) {
          const prompt = data.dailyPrompts.find(
            (p) => p.id === answer.promptId,
          );
          return [
            {
              pin,
              day: review.periodStart,
              source: prompt?.label ?? "Answer",
              text: answer.body,
            },
          ];
        }
      }
      return [];
    }
    const note = data.notes.find((n) => n.id === pin.noteId);
    if (!note) return [];
    return [
      {
        pin,
        day: DateTime.fromISO(note.createdTime).toISODate() ?? undefined,
        source: `${(config[note.type] ?? config[0]).label} note`,
        text: firstLine(note),
      },
    ];
  });
