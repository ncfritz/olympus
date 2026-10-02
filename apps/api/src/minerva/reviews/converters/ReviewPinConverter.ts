import { ReviewPin } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.review_pins` row as Hasura returns it (custom column names). */
export type GraphQlReviewPin = {
  id: string;
  reviewId: string;
  answerId: string | null;
  noteId: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (input: GraphQlReviewPin): ReviewPin => ({
  id: input.id,
  reviewId: input.reviewId,
  answerId: input.answerId ?? undefined,
  noteId: input.noteId ?? undefined,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
