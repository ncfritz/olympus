import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * What a weekly review keeps from its week (ADR 0027): an answer from one
 * of the week's daily reviews, or a note.
 */
export class ReviewPin {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the pin",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The weekly review that keeps the pin",
  })
  reviewId: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The daily review answer pinned; set when the pin is not a note's",
  })
  answerId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The note pinned; set when the pin is not an answer's",
  })
  noteId?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the pin was made",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the pin was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to pin: exactly one of an answer or a note. */
export class BaseReviewPin {
  @ApiProperty({
    type: String,
    required: false,
    description:
      "An answer from one of the week's daily reviews; give this or noteId",
  })
  answerId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "A note; give this or answerId",
  })
  noteId?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateReviewPinRequest {
  @ApiProperty({
    type: () => BaseReviewPin,
    required: true,
    description: "What to pin: an answer from the week, or a note.",
  })
  reviewPin: BaseReviewPin;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListReviewPinsResponse {
  @ApiProperty({
    type: () => ReviewPin,
    isArray: true,
    required: true,
    description: "The review's pins, oldest first.",
  })
  reviewPins: ReviewPin[];
}

export class CreateReviewPinResponse {
  @ApiProperty({
    type: () => ReviewPin,
    required: true,
    description: "The pin as made.",
  })
  reviewPin: ReviewPin;
}
