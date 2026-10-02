import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a review's author wrote for one of its prompts (ADR 0027). */
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
    description: "What was written, at most 10,000 characters",
  })
  body: string;

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

/** An answer as written; an empty body removes it. */
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
