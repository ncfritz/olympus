import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { ReviewItem } from "./items";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * What a review's author wrote for one of its prompts (ADR 0027): the
 * answer to a text prompt, or one item of a list prompt's answer.
 */
export class ReviewAnswer {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the answer",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The prompt the answer is to",
  })
  promptId: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "What was written: at most 10,000 characters for a text prompt, 200 for a list item",
  })
  body: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the item sits among its prompt's items in the review; lower comes first. A text answer is at 0.",
  })
  position: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The to-do the item became, if it did",
  })
  reviewItemId?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the answer was written or last changed after its review was completed",
  })
  editedLater: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the answer was first written",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the answer was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** An answer or list item as written; an empty text answer removes it. */
export class PartialReviewAnswer extends PartialType(
  PickType(ReviewAnswer, ["body"] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class UpdateReviewAnswerRequest {
  @ApiProperty({
    type: () => PartialReviewAnswer,
    required: true,
    description:
      "The answer as it should now read. A body that is empty or only whitespace removes the answer.",
  })
  answer: PartialReviewAnswer;
}

export class CreateReviewAnswerItemRequest {
  @ApiProperty({
    type: () => PartialReviewAnswer,
    required: true,
    description:
      "The item to add at the end of the prompt's list: 1 to 200 characters.",
  })
  answer: PartialReviewAnswer;
}

export class UpdateReviewAnswerItemRequest {
  @ApiProperty({
    type: () => PartialReviewAnswer,
    required: true,
    description: "The item as it should now read: 1 to 200 characters.",
  })
  answer: PartialReviewAnswer;
}

export class ReorderReviewAnswerItemsRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every item ID of the prompt's list in the review, in the order they should appear.",
  })
  answerIds: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class UpdateReviewAnswerResponse {
  @ApiProperty({
    type: () => ReviewAnswer,
    required: true,
    description: "The answer as saved.",
  })
  answer: ReviewAnswer;
}

export class CreateReviewAnswerItemResponse {
  @ApiProperty({
    type: () => ReviewAnswer,
    required: true,
    description: "The item as added.",
  })
  answer: ReviewAnswer;
}

export class UpdateReviewAnswerItemResponse {
  @ApiProperty({
    type: () => ReviewAnswer,
    required: true,
    description: "The item as saved.",
  })
  answer: ReviewAnswer;
}

export class ReorderReviewAnswerItemsResponse {
  @ApiProperty({
    type: () => ReviewAnswer,
    isArray: true,
    required: true,
    description: "The prompt's items in the review, in their new order.",
  })
  answers: ReviewAnswer[];
}

export class CreateReviewAnswerTodoResponse {
  @ApiProperty({
    type: () => ReviewAnswer,
    required: true,
    description: "The item, linked to its to-do.",
  })
  answer: ReviewAnswer;

  @ApiProperty({
    type: () => ReviewItem,
    required: true,
    description:
      "The to-do: last of the period after the review's, titled as the item reads.",
  })
  reviewItem: ReviewItem;
}
