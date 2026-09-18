import { ApiTimestamp } from "../../decorators";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";

export enum ContentTagType {
  SOURCE = "source",
  USER = "user",
  TYPE = "type",
  SYSTEM = "system",
  MODEL = "model",
}

export class BaseContentAssetTag {
  @ApiProperty({ type: String, required: true, description: "The name of tag" })
  name: string;

  @ApiProperty({
    enum: () => ContentTagType,
    enumName: "ContentTagType",
    required: true,
    description: "The type of tag",
  })
  type: ContentTagType;
}

export class ContentAssetTag extends BaseContentAssetTag {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique Id of the tag",
  })
  id: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the tag was created",
  })
  createdTime: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class AddContentAssetTagToAssetRequest {
  @ApiProperty({
    type: () => BaseContentAssetTag,
    required: true,
    description: "The tag to be added to an asset",
  })
  tag: BaseContentAssetTag;
}

export class CreateContentAssetTagRequest {
  @ApiProperty({
    type: () => BaseContentAssetTag,
    required: true,
    description: "The tag to be created",
  })
  tag: BaseContentAssetTag;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class ListAvailableContentAssetTagsResponse {
  @ApiProperty({
    type: () => ContentAssetTag,
    isArray: true,
    required: true,
    description: "The list of all asset tags NOT associated with the asset",
  })
  tags: ContentAssetTag[];
}

export class ListContentAssetTagsForAssetResponse {
  @ApiProperty({
    type: () => ContentAssetTag,
    isArray: true,
    required: true,
    description: "The list of all asset tags associated with the asset",
  })
  tags: ContentAssetTag[];
}

export class CreateContentAssetTagResponse {
  @ApiProperty({
    type: () => ContentAssetTag,
    required: true,
    description:
      "The newly created tag.  The tag will be stamped with a generated ID that can be used to tag sets.",
  })
  tag: ContentAssetTag;
}
