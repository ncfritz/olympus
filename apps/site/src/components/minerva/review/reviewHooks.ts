import type { Review, ReviewKind } from "@ncfritz/olympus-sdk/minerva";
import { message } from "antd";
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
