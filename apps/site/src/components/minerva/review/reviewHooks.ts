import type {
  Review,
  ReviewAnswer,
  ReviewKind,
} from "@ncfritz/olympus-sdk/minerva";
import { message } from "antd";
import type React from "react";
import { useRef } from "react";
import reviewsApi from "../../../api/reviewsApi";
import { apiProblems } from "../../../utils/goals";

/** Says what went wrong: the API's problems, else the fallback. */
export const fail = (error: unknown, fallback: string) => {
  const problems = apiProblems(error);
  message.error(
    problems[0] === "Something went wrong; try again."
      ? fallback
      : problems.join("; "),
  );
};

/**
 * A review started on the first thing saved, not on opening it (ADR
 * 0027): answers the review, starting it now when there is none yet. Two
 * saves at once start it once; one started elsewhere meanwhile is used.
 */
export const useStartReview = (
  kind: ReviewKind,
  /** The period as a new review names it: YYYY-MM-DD, or YYYY-Www. */
  period: string,
  /** Its first day, YYYY-MM-DD, as the reviews are listed by. */
  periodStart: string,
  review: Review | undefined,
  setReview: (review: Review) => void,
): (() => Promise<Review>) => {
  const starting = useRef<Promise<Review> | undefined>(undefined);
  return async () => {
    if (review) return review;
    if (!starting.current) {
      starting.current = reviewsApi
        .createReview(kind, period)
        .catch(async (error) => {
          const [existing] = await reviewsApi.listReviews(
            kind,
            periodStart,
            periodStart,
          );
          if (existing) return existing;
          throw error;
        })
        .then((started) => {
          setReview(started);
          return started;
        })
        .finally(() => {
          starting.current = undefined;
        });
    }
    return starting.current;
  };
};

/** What a review does with its answers: text prompts' and lists' items. */
export type AnswerActions = {
  /** A text prompt's answer; empty removes it. */
  saveAnswer: (promptId: string, body: string) => Promise<void>;
  addAnswerItem: (promptId: string, body: string) => Promise<void>;
  editAnswerItem: (answer: ReviewAnswer, body: string) => Promise<void>;
  removeAnswerItem: (answer: ReviewAnswer) => Promise<void>;
  reorderAnswerItems: (promptId: string, ids: string[]) => Promise<void>;
  /** Makes an item a to-do of the period after the review's. */
  answerItemToTodo: (answer: ReviewAnswer) => Promise<void>;
};

/** A prompt's answers in a review, in their order. */
export const answersOf = (
  review: Pick<Review, "answers"> | undefined,
  promptId: string,
): ReviewAnswer[] =>
  (review?.answers ?? [])
    .filter((a) => a.promptId === promptId)
    .sort((a, b) => a.position - b.position);

/**
 * The answer actions of a review, saving as each change is made and
 * keeping the review's answers in step. `onTodo` runs after an item became
 * a to-do, to show it in the plan.
 */
export const useAnswerActions = (
  review: Review | undefined,
  setReview: React.Dispatch<React.SetStateAction<Review | undefined>>,
  ensureReview: () => Promise<Review>,
  onTodo: () => Promise<void>,
): AnswerActions => {
  /** The review's answers with `change` applied. */
  const update = (change: (answers: ReviewAnswer[]) => ReviewAnswer[]) =>
    setReview((r) => (r ? { ...r, answers: change(r.answers) } : r));
  const replace = (saved: ReviewAnswer) =>
    update((answers) => [...answers.filter((a) => a.id !== saved.id), saved]);

  return {
    saveAnswer: async (promptId, body) => {
      const existing = answersOf(review, promptId)[0];
      if ((existing?.body ?? "") === body.trim()) return;
      try {
        const current = await ensureReview();
        const saved = await reviewsApi.saveAnswer(current.id, promptId, body);
        update((answers) => [
          ...answers.filter((a) => a.promptId !== promptId),
          ...(saved ? [saved] : []),
        ]);
      } catch (error) {
        fail(error, "Could not save your answer");
      }
    },
    addAnswerItem: async (promptId, body) => {
      try {
        const current = await ensureReview();
        const saved = await reviewsApi.addAnswerItem(
          current.id,
          promptId,
          body,
        );
        update((answers) => [...answers, saved]);
      } catch (error) {
        fail(error, "Could not add that");
      }
    },
    editAnswerItem: async (answer, body) => {
      if (!review || answer.body === body.trim()) return;
      try {
        replace(
          await reviewsApi.updateAnswerItem(
            review.id,
            answer.promptId,
            answer.id,
            body,
          ),
        );
      } catch (error) {
        fail(error, "Could not save that");
      }
    },
    removeAnswerItem: async (answer) => {
      if (!review) return;
      try {
        await reviewsApi.deleteAnswerItem(
          review.id,
          answer.promptId,
          answer.id,
        );
        update((answers) => answers.filter((a) => a.id !== answer.id));
      } catch (error) {
        fail(error, "Could not remove that");
      }
    },
    reorderAnswerItems: async (promptId, ids) => {
      if (!review) return;
      // Shown in the new order at once; put back if the save fails.
      const before = review.answers;
      update((answers) =>
        answers.map((a) =>
          ids.includes(a.id) ? { ...a, position: ids.indexOf(a.id) } : a,
        ),
      );
      try {
        const saved = await reviewsApi.reorderAnswerItems(
          review.id,
          promptId,
          ids,
        );
        update((answers) => [
          ...answers.filter((a) => a.promptId !== promptId),
          ...saved,
        ]);
      } catch (error) {
        update(() => before);
        fail(error, "Could not save the new order");
      }
    },
    answerItemToTodo: async (answer) => {
      if (!review) return;
      try {
        const { answer: linked } = await reviewsApi.answerItemToTodo(
          review.id,
          answer.promptId,
          answer.id,
        );
        replace(linked);
        await onTodo();
      } catch (error) {
        fail(error, "Could not make that a to-do");
      }
    },
  };
};
