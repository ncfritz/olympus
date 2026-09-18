import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { MediaAssetSearchConfiguration, SparseMediaFavorite } from "../media";
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
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => value.toISOString())
  airDate?: Moment;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  overview: string;

  @ApiProperty({ type: String, required: false })
  posterPath?: string;

  @ApiProperty({ required: true, type: Number })
  seasonNumber: number;

  @ApiProperty({ required: true, type: Number })
  voteAverage: number;
}

export class SparseSeason extends BaseSeason {
  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
  })
  favorite?: SparseMediaFavorite;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ required: true, type: Number })
  episodeCount: number;
}

export class Season extends SparseSeason {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
  })
  series: BaseTVSeries;

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
  })
  videos: Video[];

  @ApiProperty({
    required: true,
    type: () => SparseEpisode,
    isArray: true,
  })
  episodes: SparseEpisode[];
}

export class SeasonWithCastAndCrew extends Season {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}

export class PartialSeason extends BaseSeason {
  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCastMember,
    isArray: true,
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];

  @ApiProperty({
    required: true,
    type: () => PartialVideo,
    isArray: true,
  })
  videos: PartialVideo[];
}

export class CreateTVSeasonRequest {
  @ApiProperty({
    required: true,
    type: () => PartialSeason,
  })
  season: PartialSeason;
}

export class CreateTVSeasonResponse {
  @ApiProperty({
    required: true,
    type: () => Number,
  })
  seriesId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  seasonId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  seasonNumber: number;
}

export class DescribeTVSeasonResponse {
  @ApiProperty({
    required: true,
    type: () => Season,
  })
  season: Season;
}

export class ListTvSeasonCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeasonCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}
