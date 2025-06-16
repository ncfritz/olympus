import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Episode } from "./tvEpisode";
import {
  PartialTVSeriesCastMember,
  PartialTVSeriesCrewMember,
  PartialTVSeriesExternalId,
  PartialTVSeriesImage,
  PartialTVSeriesVideo,
  TVSeriesCastMember,
  TVSeriesCrewMember,
  TVSeriesExternalId,
  TVSeriesImage,
  TVSeriesVideo,
} from "./tvSeries";

export class BaseSeason {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  airDate: Moment;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  posterPath?: string;

  @ApiProperty({ type: Number })
  seasonNumber: number;
}

export class Season extends BaseSeason {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];

  @ApiProperty({
    type: () => TVSeriesImage,
    isArray: true,
  })
  images: TVSeriesImage[];

  @ApiProperty({
    type: () => TVSeriesVideo,
  })
  videos: TVSeriesVideo;

  @ApiProperty({
    type: () => TVSeriesExternalId,
    isArray: true,
  })
  externalIds: TVSeriesExternalId[];

  @ApiProperty({
    type: () => Episode,
    isArray: true,
  })
  episodes: Episode[];
}

export class PartialSeason extends BaseSeason {
  @ApiProperty({
    type: () => PartialTVSeriesCastMember,
    isArray: true,
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    type: () => PartialTVSeriesExternalId,
    isArray: true,
  })
  externalIds: PartialTVSeriesExternalId[];

  @ApiProperty({
    type: () => PartialTVSeriesImage,
    isArray: true,
  })
  images: PartialTVSeriesImage[];

  @ApiProperty({
    type: () => PartialTVSeriesVideo,
    isArray: true,
  })
  videos: PartialTVSeriesVideo[];
}

export class CreateTVSeasonRequest {
  @ApiProperty({
    type: () => PartialSeason,
  })
  season: PartialSeason;
}

export class CreateTVSeasonResponse {
  @ApiProperty({
    type: () => Season,
  })
  season: Season;
}
