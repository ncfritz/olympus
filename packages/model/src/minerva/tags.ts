import { ApiProperty, PartialType, PickType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A label a user puts on their Minerva items (ADR 0026), first on goals.
 * A user's tag names are unique whatever their case.
 */
export class Tag {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the tag",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The tag's name, 1 to 50 characters, unique among the user's tags whatever its case",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The tag's colour as a lowercase hex value such as #1677ff; absent for the default chip",
  })
  color?: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the tag was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the tag was last changed",
  })
  lastUpdatedTime?: Moment;
}

/** What is supplied to create a tag. */
export class BaseTag extends PickType(Tag, ["name", "color"] as const) {}

/** The changes to a tag; only what is named is changed. */
export class PartialTag extends PartialType(BaseTag) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateTagRequest {
  @ApiProperty({
    type: () => BaseTag,
    required: true,
    description: "The tag to create.",
  })
  tag: BaseTag;
}

export class UpdateTagRequest {
  @ApiProperty({
    type: () => PartialTag,
    required: true,
    description:
      "The changes to the tag. A color of null removes the tag's colour.",
  })
  tag: PartialTag;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListTagsResponse {
  @ApiProperty({
    type: () => Tag,
    isArray: true,
    required: true,
    description: "The caller's tags, by name.",
  })
  tags: Tag[];
}

export class DescribeTagResponse {
  @ApiProperty({
    type: () => Tag,
    required: true,
    description: "The tag.",
  })
  tag: Tag;
}

export class CreateTagResponse {
  @ApiProperty({
    type: () => Tag,
    required: true,
    description: "The tag as created.",
  })
  tag: Tag;
}

export class UpdateTagResponse {
  @ApiProperty({
    type: () => Tag,
    required: true,
    description: "The tag with the changes applied.",
  })
  tag: Tag;
}
