import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { FilterDefinition } from "../../filter";

export class BaseContentAssetChannelCategory {
  @ApiProperty({
    type: String,
    required: true,
    description: "The display name of the content asset channel category",
  })
  name: string;
}

export class ContentAssetChannelCategory extends BaseContentAssetChannelCategory {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the content asset channel category",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the category was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the category was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The total number of channels that are in the content asset channel category",
  })
  channelCount: number;
}

export class BaseContentAssetCacheEntry {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the asset the cache entry is for",
  })
  assetId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The pixel width of the asset video",
  })
  width: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The pixel height of the asset video",
  })
  height: number;
}

export class ContentAssetChannelCacheEntry extends BaseContentAssetCacheEntry {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the asset association was cached.",
  })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime: Moment;
}

export class BaseContentAssetChannel {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ID of the category the channel is associated with",
  })
  categoryId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The display name of the content asset channel",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "A description of what types of assets are in the channel",
  })
  description: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The JSON stringified version of the `filterDefinition`",
  })
  filterInput: string;

  @ApiProperty({
    type: FilterDefinition,
    required: true,
    description:
      "The filter definition for the channel.  This value is used to generate the `filterInput` for the channel",
  })
  filterDefinition: FilterDefinition;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the channel is a favorite, `false` otherwise",
  })
  favorite: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "`true` if the channel contents are compliant with black-curtain, `false` otherwise",
  })
  bcCompliant: boolean;
}

export class ContentAssetChannel extends OmitType(BaseContentAssetChannel, [
  "categoryId",
  "filterDefinition",
]) {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the content asset channel",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The GraphQL filter string, that can be directly used as a 'where' clause in GraphQL request. " +
      "The value MUST be Base64 encoded as input and will be Base64 encoded in responses",
  })
  encodedFilter: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the channel was created.",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The time-to-live for the channel cache in days",
  })
  ttl: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The jitter, in minutes, to allow for curve smoothing",
  })
  jitter: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total number of assets in the channel",
  })
  assetCount: number;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the channel's asset cache was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastFetchedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the channel was last updated.",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: ContentAssetChannelCacheEntry,
    required: true,
    isArray: true,
    description:
      "A list of minimal asset details for the first nine assets in the channel.  This information is used to " +
      "drive thumbnail and sample video displays without needing to fetch the full asset.",
  })
  assetCache: ContentAssetChannelCacheEntry[];
}

export class FullContentAssetChannel extends ContentAssetChannel {
  @ApiProperty({
    type: ContentAssetChannelCategory,
    required: true,
    description:
      "The content asset category that this channel will be grouped under",
  })
  category: ContentAssetChannelCategory;
}

export class FullContentAssetChannelCategory extends ContentAssetChannelCategory {
  @ApiProperty({
    type: ContentAssetChannel,
    required: true,
    isArray: true,
    description:
      "A list of the first ten content asset channels in the category",
  })
  channels: ContentAssetChannel[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentAssetChannelRequest {
  @ApiProperty({
    type: BaseContentAssetChannel,
    required: true,
    description: "The channel to create",
  })
  channel: BaseContentAssetChannel;
}

export class UpdateContentAssetChannelRequest {
  @ApiProperty({
    type: BaseContentAssetChannel,
    required: true,
    description: "A channel definition representing the updates to be made",
  })
  channel: BaseContentAssetChannel;
}

export class FavoriteContentAssetChannelRequest {
  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "`true` to mark the channel as a favorite, 'false' to remove it as a favorite",
  })
  favorite: boolean;
}

export class CreateContentAssetChannelCategoryRequest {
  @ApiProperty({
    type: BaseContentAssetChannelCategory,
    required: true,
    description: "The category to crete",
  })
  category: BaseContentAssetChannelCategory;
}

export class UpdateContentAssetChannelCategoryRequest {
  @ApiProperty({
    type: BaseContentAssetChannelCategory,
    required: true,
    description:
      "A channel cateogry definition representing the updated to be made",
  })
  category: BaseContentAssetChannelCategory;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateContentAssetChannelResponse {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    description: "The newly created content asset channel",
  })
  channel: FullContentAssetChannel;
}

export class DescribeContentAssetChannelResponse {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    description: "The content asset channel",
  })
  channel: FullContentAssetChannel;
}

export class UpdateContentAssetChannelResponse {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    description: "The updated content asset channel",
  })
  channel: FullContentAssetChannel;
}

export class FavoriteContentAssetChannelResponse {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    description: "The content asset channel with the favorite status applied",
  })
  channel: FullContentAssetChannel;
}

export class RefreshContentAssetChannelResponse {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    description: "The content asset channel with updated cache entries",
  })
  channel: FullContentAssetChannel;
}

export class ListContentAssetChannelsResponse extends PaginatedResults {
  @ApiProperty({
    type: FullContentAssetChannel,
    required: true,
    isArray: true,
    description:
      "The set of channels that matched any filters and pagination constraints",
  })
  channels: FullContentAssetChannel[];
}

export class ListContentAssetChannelsForCategoryResponse extends PaginatedResults {
  @ApiProperty({
    type: ContentAssetChannel,
    required: true,
    isArray: true,
    description:
      "The set of channels in the category that matched any filters and pagination constraints",
  })
  channels: ContentAssetChannel[];
}

/* Content channel category API responses */
export class CreateContentAssetChannelCategoryResponse {
  @ApiProperty({
    type: FullContentAssetChannelCategory,
    required: true,
    description: "The newly created content asset channel category",
  })
  category: FullContentAssetChannelCategory;
}

export class DescribeContentAssetChannelCategoryResponse {
  @ApiProperty({
    type: FullContentAssetChannelCategory,
    required: true,
    description: "The content asset channel category",
  })
  category: FullContentAssetChannelCategory;
}

export class UpdateContentAssetChannelCategoryResponse {
  @ApiProperty({
    type: FullContentAssetChannelCategory,
    required: true,
    description: "The content asset channel category with updates applied",
  })
  category: FullContentAssetChannelCategory;
}

export class ListContentAssetChannelCategoriesResponse extends PaginatedResults {
  @ApiProperty({
    type: FullContentAssetChannelCategory,
    required: true,
    isArray: true,
    description:
      "The set of content asset categories that matched any filters and pagination constraints",
  })
  categories: FullContentAssetChannelCategory[];
}

export class ListContentAssetCategoryChannelsResponse extends PaginatedResults {
  @ApiProperty({
    type: ContentAssetChannel,
    required: true,
    isArray: true,
    description:
      "The list of channels in the category that matched any filter or pagination constraints",
  })
  channels: ContentAssetChannel[];
}
