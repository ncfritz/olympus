import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

export enum ContentTagType {
  SOURCE = "source",
  USER = "user",
  TYPE = "type",
  SYSTEM = "system",
  MODEL = "model",
}

export class BaseContentAssetTag {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ enum: () => ContentTagType, enumName: "ContentTagType" })
  type: ContentTagType;
}

export class ContentAssetTag extends BaseContentAssetTag {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;
}

export class ListAvailableContentAssetTagsResponse {
  @ApiProperty({ type: () => ContentAssetTag, isArray: true })
  tags: ContentAssetTag[];
}

export class ListContentAssetTagsForAssetResponse {
  @ApiProperty({ type: () => ContentAssetTag, isArray: true })
  tags: ContentAssetTag[];
}

export class AddContentAssetTagToAssetRequest {
  @ApiProperty({ type: () => BaseContentAssetTag })
  tag: BaseContentAssetTag;
}

export class RemoveContentAssetTagFromAsset {
  @ApiProperty({ type: String })
  contentAssetTagId: string;
}

export class CreateContentAssetTagRequest {
  @ApiProperty({ type: () => BaseContentAssetTag })
  tag: BaseContentAssetTag;
}

export class CreateContentAssetTagResponse {
  @ApiProperty({ type: () => ContentAssetTag })
  tag: ContentAssetTag;
}
