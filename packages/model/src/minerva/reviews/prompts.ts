import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";
import { ReviewKind } from "./reviews";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The guided step a prompt is asked in. */
export enum ReviewPromptSection {
  Reflect = "reflect",
  Plan = "plan",
}

/** How a prompt is answered: one block of text, or a list of short items. */
export enum ReviewPromptStyle {
  Text = "text",
  List = "list",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A question a user's reviews of one kind ask (ADR 0027). A prompt with
 * answers is archived rather than deleted, so old reviews keep it.
 */
export class ReviewPrompt {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the prompt",
  })
  id: string;

  @ApiProperty({
    enum: () => ReviewKind,
    enumName: "ReviewKind",
    enumSchema: {
      description: "Whether a review is of a day or of an ISO week",
    },
    required: true,
    description: "The kind of review that asks the prompt",
  })
  kind: ReviewKind;

  @ApiProperty({
    enum: () => ReviewPromptSection,
    enumName: "ReviewPromptSection",
    enumSchema: {
      description: "The guided step a review prompt is asked in",
    },
    required: true,
    description: "The step the prompt is asked in",
  })
  section: ReviewPromptSection;

  @ApiProperty({
    enum: () => ReviewPromptStyle,
    enumName: "ReviewPromptStyle",
    enumSchema: {
      description:
        "How a review prompt is answered: one block of text, or a list of short items",
    },
    required: true,
    description: "How the prompt is answered",
  })
  style: ReviewPromptStyle;

  @ApiProperty({
    type: String,
    required: true,
    description: "The question, 1 to 120 characters",
  })
  label: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "A hint shown in the empty answer box, at most 200 characters",
  })
  placeholder?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the prompt sits among its kind and section; lower comes first",
  })
  position: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the prompt is archived: no longer asked, its answers kept",
  })
  archived: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the prompt was archived",
  })
  archivedTime?: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the prompt was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the prompt was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to create a prompt; it is added at the end of its section. */
export class BaseReviewPrompt extends PickType(ReviewPrompt, [
  "kind",
  "section",
  "label",
  "placeholder",
] as const) {
  @ApiProperty({
    enum: () => ReviewPromptStyle,
    enumName: "ReviewPromptStyle",
    enumSchema: {
      description:
        "How a review prompt is answered: one block of text, or a list of short items",
    },
    required: false,
    description: "How the prompt is answered; text when left out",
  })
  style?: ReviewPromptStyle;
}

/** The changes to a prompt; its kind and section are fixed. */
export class PartialReviewPrompt extends PartialType(
  PickType(ReviewPrompt, [
    "label",
    "style",
    "placeholder",
    "archived",
  ] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateReviewPromptRequest {
  @ApiProperty({
    type: () => BaseReviewPrompt,
    required: true,
    description: "The prompt to add at the end of its kind and section.",
  })
  reviewPrompt: BaseReviewPrompt;
}

export class UpdateReviewPromptRequest {
  @ApiProperty({
    type: () => PartialReviewPrompt,
    required: true,
    description:
      "The changes to the prompt. A placeholder of null removes it; archived true archives it and false brings it back. A prompt becomes text only while no review holds more than one item for it.",
  })
  reviewPrompt: PartialReviewPrompt;
}

export class ReorderReviewPromptsRequest {
  @ApiProperty({
    enum: () => ReviewKind,
    enumName: "ReviewKind",
    enumSchema: {
      description: "Whether a review is of a day or of an ISO week",
    },
    required: true,
    description: "The kind of review whose prompts are reordered",
  })
  kind: ReviewKind;

  @ApiProperty({
    enum: () => ReviewPromptSection,
    enumName: "ReviewPromptSection",
    enumSchema: {
      description: "The guided step a review prompt is asked in",
    },
    required: true,
    description: "The step whose prompts are reordered",
  })
  section: ReviewPromptSection;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every one of the caller's prompt IDs of that kind and section, archived ones included, in the order they should appear.",
  })
  promptIds: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListReviewPromptsResponse {
  @ApiProperty({
    type: () => ReviewPrompt,
    isArray: true,
    required: true,
    description:
      "The caller's prompts: daily before weekly, Reflect before Plan, each in its order.",
  })
  reviewPrompts: ReviewPrompt[];
}

export class DescribeReviewPromptResponse {
  @ApiProperty({
    type: () => ReviewPrompt,
    required: true,
    description: "The prompt.",
  })
  reviewPrompt: ReviewPrompt;
}

export class CreateReviewPromptResponse {
  @ApiProperty({
    type: () => ReviewPrompt,
    required: true,
    description: "The prompt as created.",
  })
  reviewPrompt: ReviewPrompt;
}

export class UpdateReviewPromptResponse {
  @ApiProperty({
    type: () => ReviewPrompt,
    required: true,
    description: "The prompt with the changes applied.",
  })
  reviewPrompt: ReviewPrompt;
}

export class ReorderReviewPromptsResponse {
  @ApiProperty({
    type: () => ReviewPrompt,
    isArray: true,
    required: true,
    description: "All of the caller's prompts, in their new order.",
  })
  reviewPrompts: ReviewPrompt[];
}
