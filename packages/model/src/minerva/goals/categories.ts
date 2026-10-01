import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The icons a goal category can show; the site maps each to an AntD icon. */
export enum GoalCategoryIcon {
  Heart = "heart",
  Laptop = "laptop",
  Team = "team",
  Wallet = "wallet",
  Book = "book",
  Home = "home",
  Star = "star",
  Compass = "compass",
  Trophy = "trophy",
  Smile = "smile",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * An area of a user's life their goals sit in, with a vision of what good
 * looks like there (ADR 0026).
 */
export class GoalCategory {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the category",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The category's name, 1 to 50 characters, unique among the user's categories whatever its case",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The category's colour as a lowercase hex value such as #52c41a",
  })
  color: string;

  @ApiProperty({
    enum: () => GoalCategoryIcon,
    enumName: "GoalCategoryIcon",
    required: true,
    description: "The icon shown beside the category's name",
  })
  icon: GoalCategoryIcon;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "What good looks like in this area of life, at most 2,000 characters",
  })
  vision?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Where the category sits in the user's list; lower comes first",
  })
  position: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the category is archived: hidden from pickers, its goals kept",
  })
  archived: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the category was archived",
  })
  archivedTime?: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the category was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the category was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to create a category; it is added at the end. */
export class BaseGoalCategory extends PickType(GoalCategory, [
  "name",
  "color",
  "icon",
  "vision",
] as const) {}

/** The changes to a category; only what is named is changed. */
export class PartialGoalCategory extends PartialType(
  PickType(GoalCategory, [
    "name",
    "color",
    "icon",
    "vision",
    "archived",
  ] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateGoalCategoryRequest {
  @ApiProperty({
    type: () => BaseGoalCategory,
    required: true,
    description: "The category to add at the end of the caller's list.",
  })
  goalCategory: BaseGoalCategory;
}

export class UpdateGoalCategoryRequest {
  @ApiProperty({
    type: () => PartialGoalCategory,
    required: true,
    description:
      "The changes to the category. A vision of null removes it; archived true archives it and false brings it back.",
  })
  goalCategory: PartialGoalCategory;
}

export class ReorderGoalCategoriesRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "Every one of the caller's category IDs, archived ones included, in the order they should appear.",
  })
  categoryIds: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListGoalCategoriesResponse {
  @ApiProperty({
    type: () => GoalCategory,
    isArray: true,
    required: true,
    description: "The caller's categories, in their order.",
  })
  goalCategories: GoalCategory[];
}

export class DescribeGoalCategoryResponse {
  @ApiProperty({
    type: () => GoalCategory,
    required: true,
    description: "The category.",
  })
  goalCategory: GoalCategory;
}

export class CreateGoalCategoryResponse {
  @ApiProperty({
    type: () => GoalCategory,
    required: true,
    description: "The category as created.",
  })
  goalCategory: GoalCategory;
}

export class UpdateGoalCategoryResponse {
  @ApiProperty({
    type: () => GoalCategory,
    required: true,
    description: "The category with the changes applied.",
  })
  goalCategory: GoalCategory;
}

export class ReorderGoalCategoriesResponse {
  @ApiProperty({
    type: () => GoalCategory,
    isArray: true,
    required: true,
    description: "The caller's categories in their new order.",
  })
  goalCategories: GoalCategory[];
}
