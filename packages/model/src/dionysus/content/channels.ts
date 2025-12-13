import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { FilterDefinition } from "../../filter";

export class BaseContentAssetChannelCategory {
  @ApiProperty({ type: String })
  name: string;
}

export class ContentAssetChannelCategory extends BaseContentAssetChannelCategory {
  @ApiProperty({ type: String, required: true })
  id: string;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the category was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the category was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: Number, required: true })
  channelCount: number;
}

export class BaseContentAssetCacheEntry {
  @ApiProperty({ type: String, required: true })
  assetId: string;

  @ApiProperty({ type: Number, required: true })
  width: number;

  @ApiProperty({ type: Number, required: true })
  height: number;
}

export class ContentAssetChannelCacheEntry extends BaseContentAssetCacheEntry {
  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the asset association was cached.",
  })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime: Moment;
}

export class BaseContentAssetChannel {
  @ApiProperty({ type: String, required: true })
  categoryId: string;

  @ApiProperty({ type: String, required: true })
  name: string;

  @ApiProperty({ type: String, required: true })
  description: string;

  @ApiProperty({ type: String, required: true })
  filterInput: string;

  @ApiProperty({ type: FilterDefinition, required: true })
  filterDefinition: FilterDefinition;

  @ApiProperty({ type: Boolean, required: true })
  favorite: boolean;

  @ApiProperty({ type: Boolean, required: true })
  bcCompliant: boolean;
}

export class ContentAssetChannel extends OmitType(BaseContentAssetChannel, [
  "categoryId",
  "filterDefinition",
]) {
  @ApiProperty({ type: String, required: true })
  id: string;

  @ApiProperty({ type: String, required: true })
  encodedFilter: string;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the channel was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: Number, required: true })
  ttl: number;

  @ApiProperty({ type: Number, required: true })
  jitter: number;

  @ApiProperty({ type: Number, required: true })
  assetCount: number;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the channel's asset cache was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime: Moment;

  @ApiProperty({
    type: String,
    description:
      "An ISO-8601 formatted string indicating when the channel was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: ContentAssetChannelCacheEntry,
    required: true,
    isArray: true,
  })
  assetCache: ContentAssetChannelCacheEntry[];
}

export class FullContentAssetChannel extends ContentAssetChannel {
  @ApiProperty({ type: ContentAssetChannelCategory, required: true })
  category: ContentAssetChannelCategory;
}

export class FullContentAssetChannelCategory extends ContentAssetChannelCategory {
  @ApiProperty({
    type: ContentAssetChannel,
    required: true,
    isArray: true,
  })
  channels: ContentAssetChannel[];
}

export class CreateContentAssetChannelCategoryRequest {
  @ApiProperty({ type: BaseContentAssetChannelCategory, required: true })
  category: BaseContentAssetChannelCategory;
}

export class CreateContentAssetChannelCategoryResponse {
  @ApiProperty({ type: FullContentAssetChannelCategory, required: true })
  category: FullContentAssetChannelCategory;
}

export class UpdateContentAssetChannelCategoryRequest {
  @ApiProperty({ type: BaseContentAssetChannelCategory, required: true })
  category: BaseContentAssetChannelCategory;
}

export class UpdateContentAssetChannelCategoryResponse {
  @ApiProperty({ type: FullContentAssetChannelCategory, required: true })
  category: FullContentAssetChannelCategory;
}

export class ListContentAssetChannelsResponse extends PaginatedResults {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    isArray: true,
  })
  channels: FullContentAssetChannel[];
}

export class ListContentAssetChannelCategoriesResponse extends PaginatedResults {
  @ApiProperty({
    type: FullContentAssetChannelCategory,
    required: true,
    isArray: true,
  })
  categories: FullContentAssetChannelCategory[];
}

export class ListContentAssetChannelsForCategoryResponse extends PaginatedResults {
  @ApiProperty({
    type: ContentAssetChannel,
    required: true,
    isArray: true,
  })
  channels: ContentAssetChannel[];
}

export class DescribeContentAssetChannelCategoryResponse {
  @ApiProperty({ type: FullContentAssetChannelCategory, required: true })
  category: FullContentAssetChannelCategory;
}

export class CreateContentAssetChannelRequest {
  @ApiProperty({ type: BaseContentAssetChannel, required: true })
  channel: BaseContentAssetChannel;
}

export class CreateContentAssetChannelResponse {
  @ApiProperty({ type: FullContentAssetChannel, required: true })
  channel: FullContentAssetChannel;
}

export class UpdateContentAssetChannelRequest {
  @ApiProperty({ type: BaseContentAssetChannel, required: true })
  channel: BaseContentAssetChannel;
}

export class FavoriteContentAssetChannelRequest {
  @ApiProperty({ type: Boolean, required: true })
  favorite: boolean;
}

export class FavoriteContentAssetChannelResponse {
  @ApiProperty({ type: FullContentAssetChannel, required: true })
  channel: FullContentAssetChannel;
}

export class UpdateContentAssetChannelResponse {
  @ApiProperty({ type: FullContentAssetChannel, required: true })
  channel: FullContentAssetChannel;
}

export class DescribeContentAssetChannelResponse {
  @ApiProperty({ type: FullContentAssetChannel, required: true })
  channel: FullContentAssetChannel;
}

export class ListContentAssetCategoryChannelsResponse extends PaginatedResults {
  @ApiProperty({ type: ContentAssetChannel, required: true, isArray: true })
  channels: ContentAssetChannel[];
}

export class RefreshContentAssetChannelResponse {
  @ApiProperty({ type: FullContentAssetChannel, required: true })
  channel: FullContentAssetChannel;
}
