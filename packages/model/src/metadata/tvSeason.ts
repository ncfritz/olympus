import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Episode, PartialEpisode } from "./tvEpisode";
import { TVSeries, TVSeriesVideo } from "./tvSeries";

export class BaseSeason {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  alternateId: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  airDate: Moment;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  posterPath: string;

  @ApiProperty({ type: Number })
  seasonNumber: number;

  @ApiProperty({
    type: () => TVSeriesVideo,
  })
  series: TVSeries;
}

export class Season extends BaseSeason {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => TVSeasonExternalId,
    isArray: true,
  })
  externalIds: TVSeasonExternalId[];

  @ApiProperty({
    type: () => Episode,
    isArray: true,
  })
  episodes: Episode[];
}

export class PartialSeason extends BaseSeason {
  @ApiProperty({
    type: () => PartialTVSeasonExternalId,
    isArray: true,
  })
  externalIds: PartialTVSeasonExternalId[];

  @ApiProperty({
    type: () => PartialEpisode,
    isArray: true,
  })
  episodes: PartialEpisode[];
}

export class TVSeasonExternalId {
  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  externalId: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeasonExternalId extends OmitType(TVSeasonExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}
