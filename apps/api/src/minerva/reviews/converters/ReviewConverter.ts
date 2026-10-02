import { Review, ReviewAnswer, ReviewKind } from "@ncfritz/olympus-model";
import moment from "moment";
import { periodEndOf } from "../utils/periods";

/** A `minerva.review_answers` row as Hasura returns it (custom column names). */
export type GraphQlReviewAnswer = {
  id: string;
  promptId: string;
  body: string;
  position: number;
  reviewItemId: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

/** A `minerva.reviews` row with its answers, as Hasura returns it. */
export type GraphQlReview = {
  id: string;
  kind: string;
  periodStart: string;
  step: number;
  overall: number | null;
  mood: number | null;
  energy: number | null;
  focus: number | null;
  progress: number | null;
  balance: number | null;
  completedTime: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
  answers: GraphQlReviewAnswer[];
};

/**
 * An answer, marked edited later when it was written or last changed after
 * its review was completed.
 */
export const toReviewAnswer = (
  input: GraphQlReviewAnswer,
  completedTime: string | null,
): ReviewAnswer => {
  const written = moment(input.lastUpdatedTime ?? input.createdTime);
  return {
    id: input.id,
    promptId: input.promptId,
    body: input.body,
    position: input.position,
    reviewItemId: input.reviewItemId ?? undefined,
    editedLater:
      completedTime !== null && written.isAfter(moment(completedTime)),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
  };
};

/**
 * A rating as Hasura returns it: numeric(2,1), a number unless the
 * engine is set to stringify numerics, so either is read.
 */
export const ratingOf = (
  value: number | string | null | undefined,
): number | undefined =>
  value === null || value === undefined ? undefined : Number(value);

export const toDomainObject = (input: GraphQlReview): Review => {
  const kind = input.kind as ReviewKind;
  return {
    id: input.id,
    kind,
    periodStart: input.periodStart,
    periodEnd: periodEndOf(kind, input.periodStart),
    step: input.step,
    overall: ratingOf(input.overall),
    mood: ratingOf(input.mood),
    energy: ratingOf(input.energy),
    focus: ratingOf(input.focus),
    progress: ratingOf(input.progress),
    balance: ratingOf(input.balance),
    completed: input.completedTime !== null,
    completedTime: input.completedTime
      ? moment(input.completedTime)
      : undefined,
    answers: input.answers.map((answer) =>
      toReviewAnswer(answer, input.completedTime),
    ),
    createdTime: moment(input.createdTime),
    lastUpdatedTime: input.lastUpdatedTime
      ? moment(input.lastUpdatedTime)
      : undefined,
  };
};
