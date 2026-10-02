import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Whether a plan item is for a day or for an ISO week. */
export enum ReviewItemScope {
  Day = "day",
  Week = "week",
}

/** A Top 3 (or week's) priority, or a to-do. */
export enum ReviewItemKind {
  Priority = "priority",
  Todo = "todo",
}

/** Where a plan item stands. */
export enum ReviewItemStatus {
  Open = "open",
  Done = "done",
  Carried = "carried",
  Someday = "someday",
  Dropped = "dropped",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A priority or to-do a review planned for a day or a week (ADR 0027). It
 * stays a review item until Tasks exists. Carrying it marks it carried and
 * makes a copy for a later period, so its history is a chain.
 */
export class ReviewItem {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the item",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The review that planned the item, or carried it here",
  })
  reviewId: string;

  @ApiProperty({
    enum: () => ReviewItemScope,
    enumName: "ReviewItemScope",
    enumSchema: {
      description: "Whether a plan item is for a day or for an ISO week",
    },
    required: true,
    description: "Whether the item is for a day or a week",
  })
  scope: ReviewItemScope;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description:
      "The day the item is for, or the Monday of its week, as YYYY-MM-DD",
  })
  periodStart: string;

  @ApiProperty({
    enum: () => ReviewItemKind,
    enumName: "ReviewItemKind",
    enumSchema: { description: "A plan item's kind: a priority or a to-do" },
    required: true,
    description: "Whether the item is a priority or a to-do",
  })
  kind: ReviewItemKind;

  @ApiProperty({
    type: String,
    required: true,
    description: "What is to be done, 1 to 200 characters",
  })
  title: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the item sits among its period's items of its kind; lower comes first",
  })
  position: number;

  @ApiProperty({
    enum: () => ReviewItemStatus,
    enumName: "ReviewItemStatus",
    enumSchema: { description: "Where a plan item stands" },
    required: true,
    description:
      "open, done, carried (a copy carries on in a later period), someday or dropped",
  })
  status: ReviewItemStatus;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the item was done",
  })
  doneTime?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The item this one was carried from, while it exists",
  })
  carriedFromId?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many times the item has been carried to get here",
  })
  carryCount: number;

  @ApiProperty({
    type: String,
    format: "date",
    required: false,
    description:
      "The day the item is planned on as YYYY-MM-DD: its own day, or a day of its week",
  })
  scheduledOn?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "When the item's block of time starts on its day, as HH:mm in the caller's local time",
  })
  scheduledStart?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "When the item's block of time ends on its day, as HH:mm in the caller's local time",
  })
  scheduledEnd?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the item was planned",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the item was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to plan an item; it is for the period after the review's. */
export class BaseReviewItem extends PickType(ReviewItem, [
  "kind",
  "title",
] as const) {}

/** The changes to an item; only what is named is changed. */
export class PartialReviewItem extends PartialType(
  PickType(ReviewItem, [
    "title",
    "status",
    "scheduledOn",
    "scheduledStart",
    "scheduledEnd",
  ] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateReviewItemRequest {
  @ApiProperty({
    type: () => BaseReviewItem,
    required: true,
    description:
      "The item to plan, at the end of its kind for the period after the review's.",
  })
  reviewItem: BaseReviewItem;
}

export class UpdateReviewItemRequest {
  @ApiProperty({
    type: () => PartialReviewItem,
    required: true,
    description:
      "The changes to the item. status may be open, done, someday or dropped (carrying has its own operation); scheduledOn, scheduledStart and scheduledEnd of null remove them.",
  })
  reviewItem: PartialReviewItem;
}

export class ReorderReviewItemsRequest {
  @ApiProperty({
    enum: () => ReviewItemScope,
    enumName: "ReviewItemScope",
    enumSchema: {
      description: "Whether a plan item is for a day or for an ISO week",
    },
    required: true,
    description: "Whether the items reordered are a day's or a week's",
  })
  scope: ReviewItemScope;

  @ApiProperty({
    type: String,
    format: "date",
    required: true,
    description: "The day, or the week's Monday, as YYYY-MM-DD",
  })
  periodStart: string;

  @ApiProperty({
    enum: () => ReviewItemKind,
    enumName: "ReviewItemKind",
    enumSchema: { description: "A plan item's kind: a priority or a to-do" },
    required: true,
    description: "The kind of item reordered",
  })
  kind: ReviewItemKind;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every one of the caller's item IDs of that period and kind, whatever their status, in the order they should appear.",
  })
  itemIds: string[];
}

export class CarryReviewItemRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The review doing the carrying; the copy is for the period after it",
  })
  reviewId: string;

  @ApiProperty({
    enum: () => ReviewItemScope,
    enumName: "ReviewItemScope",
    enumSchema: {
      description: "Whether a plan item is for a day or for an ISO week",
    },
    required: false,
    description:
      "Whether the copy is for the next day or the next week; the item's own scope when absent",
  })
  scope?: ReviewItemScope;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListReviewItemsResponse {
  @ApiProperty({
    type: () => ReviewItem,
    isArray: true,
    required: true,
    description:
      "The caller's items for the periods in the range: by period, priorities before to-dos, each in its order.",
  })
  reviewItems: ReviewItem[];
}

export class DescribeReviewItemResponse {
  @ApiProperty({
    type: () => ReviewItem,
    required: true,
    description: "The item.",
  })
  reviewItem: ReviewItem;
}

export class CreateReviewItemResponse {
  @ApiProperty({
    type: () => ReviewItem,
    required: true,
    description: "The item as planned.",
  })
  reviewItem: ReviewItem;
}

export class UpdateReviewItemResponse {
  @ApiProperty({
    type: () => ReviewItem,
    required: true,
    description: "The item with the changes applied.",
  })
  reviewItem: ReviewItem;
}

export class ReorderReviewItemsResponse {
  @ApiProperty({
    type: () => ReviewItem,
    isArray: true,
    required: true,
    description: "The period's items of that kind, in their new order.",
  })
  reviewItems: ReviewItem[];
}

export class CarryReviewItemResponse {
  @ApiProperty({
    type: () => ReviewItem,
    required: true,
    description: "The copy, open in its new period.",
  })
  reviewItem: ReviewItem;
}
