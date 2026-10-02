import {
  ReviewItem,
  ReviewItemKind,
  ReviewItemScope,
  ReviewItemStatus,
} from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.review_items` row as Hasura returns it (custom column names). */
export type GraphQlReviewItem = {
  id: string;
  reviewId: string;
  scope: string;
  periodStart: string;
  kind: string;
  title: string;
  position: number;
  status: string;
  doneTime: string | null;
  carriedFromId: string | null;
  carryCount: number;
  scheduledOn: string | null;
  /** A `time` column: HH:mm:ss. */
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

/** HH:mm from a `time` column's HH:mm:ss. */
const toClock = (time: string | null): string | undefined =>
  time ? time.substring(0, 5) : undefined;

export const toDomainObject = (input: GraphQlReviewItem): ReviewItem => ({
  id: input.id,
  reviewId: input.reviewId,
  scope: input.scope as ReviewItemScope,
  periodStart: input.periodStart,
  kind: input.kind as ReviewItemKind,
  title: input.title,
  position: input.position,
  status: input.status as ReviewItemStatus,
  doneTime: input.doneTime ? moment(input.doneTime) : undefined,
  carriedFromId: input.carriedFromId ?? undefined,
  carryCount: input.carryCount,
  scheduledOn: input.scheduledOn ?? undefined,
  scheduledStart: toClock(input.scheduledStart),
  scheduledEnd: toClock(input.scheduledEnd),
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
