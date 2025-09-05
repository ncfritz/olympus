import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import {
  ExternalId,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  TypedImage,
  Video,
} from "./common";
import { SparseEpisode } from "./tvEpisode";
import {
  BaseTVSeries,
  PartialTVSeriesCastMember,
  PartialTVSeriesCrewMember,
  TVSeriesCastMember,
  TVSeriesCrewMember,
} from "./tvSeries";

export class BaseSeason {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => value.toISOString())
  airDate?: Moment;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String, required: false })
  posterPath?: string;

  @ApiProperty({ type: Number })
  seasonNumber: number;

  @ApiProperty({ type: Number })
  voteAverage: number;
}

export class SparseSeason extends BaseSeason {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: Number })
  episodeCount: number;
}

export class Season extends SparseSeason {
  @ApiProperty({
    type: () => BaseTVSeries,
  })
  series: BaseTVSeries;

  @ApiProperty({
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];

  @ApiProperty({
    type: () => Video,
    isArray: true,
  })
  videos: Video[];

  @ApiProperty({
    type: () => SparseEpisode,
    isArray: true,
  })
  episodes: SparseEpisode[];
}

export class SeasonWithCastAndCrew extends Season {
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
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];

  @ApiProperty({
    type: () => PartialVideo,
    isArray: true,
  })
  videos: PartialVideo[];
}

export class CreateTVSeasonRequest {
  @ApiProperty({
    type: () => PartialSeason,
  })
  season: PartialSeason;
}

export class CreateTVSeasonResponse {
  @ApiProperty({
    type: () => Number,
  })
  seriesId: number;

  @ApiProperty({
    type: () => Number,
  })
  seasonId: number;

  @ApiProperty({
    type: () => Number,
  })
  seasonNumber: number;
}

export class DescribeTVSeasonResponse {
  @ApiProperty({
    type: () => Season,
  })
  season: Season;
}

export class ListTvSeasonCastResponse {
  @ApiProperty({
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeasonCrewResponse {
  @ApiProperty({
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}
