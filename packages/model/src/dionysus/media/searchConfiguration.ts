import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

export enum MediaAssetSearchType {
  MOVIE = "movie",
  TV_SERIES = "tv_series",
  TV_SEASON = "tv_season",
  TV_EPISODE = "tv_episode",
}

export class BaseMediaAssetSearchConfiguration {
  @ApiProperty({
    enum: () => MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    required: true,
    description: "The type of media asset",
  })
  type: MediaAssetSearchType;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The primary ID of the media asset search configuration.  This should be the canonical ID of the media source" +
      "and should not include the season or episode IDs if requesting a TV Season or TV Episode.",
  })
  mediaId: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the search is enabled, `false` otherwise",
  })
  enabled: boolean;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of hours to wait inbetween executions of this search configuration",
  })
  backoff: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of minutes to jitter the search execution by.  This will be used to calculate a random value" +
      "between zero and the jitter value.  This will be added to the `backoff` value when calculating the next" +
      "execution date",
  })
  jitter: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The series ID if the search configuration is associated with a TV series",
  })
  seriesId?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The season number the search configuration is associated with if the configuration is for a TV series or TV" +
      "episode",
  })
  seasonNumber?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The episode number the search configuration is associated with if the configuration is for a TV episode",
  })
  episodeNumber?: number;
}

export class MediaAssetSearchConfiguration extends BaseMediaAssetSearchConfiguration {
  @ApiProperty({
    type: String,
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the search configuration was last run",
  })
  @Transform(({ value }) => value.toISOString())
  lastExecutionTime?: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search configuration will run next",
  })
  @Transform(({ value }) => value.toISOString())
  nextExecutionTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search configuration was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search configuration was last updated",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMediaAssetSearchConfiguration extends PartialType(
  OmitType(MediaAssetSearchConfiguration, [
    "type",
    "mediaId",
    "nextExecutionTime",
  ]),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateMediaAssetSearchConfigurationRequest {
  @ApiProperty({
    type: () => BaseMediaAssetSearchConfiguration,
    required: true,
    description: "The media asset search configuration to create",
  })
  searchConfiguration: BaseMediaAssetSearchConfiguration;
}

export class UpdateMediaAssetSearchConfigurationRequest {
  @ApiProperty({
    type: () => PartialMediaAssetSearchConfiguration,
    required: true,
    description:
      "A partial media asset search configuration containing the fields to update",
  })
  searchConfiguration: PartialMediaAssetSearchConfiguration;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaAssetSearchConfigurationResponse {
  @ApiProperty({
    type: () => MediaAssetSearchConfiguration,
    required: true,
    description: "A note that has been created, updated, or queried",
  })
  searchConfiguration: MediaAssetSearchConfiguration;
}
