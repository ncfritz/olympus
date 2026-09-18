import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import {
  MediaAsset,
  MediaAssetSearchConfiguration,
  SparseMediaFavorite,
} from "../media";
import {
  ExternalId,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  TypedImage,
  Video,
} from "./common";
import { BasePerson } from "./people";
import { SparseSeason } from "./tvSeason";
import { BaseTVSeries, SparseTvSeries } from "./tvSeries";

export class BaseEpisode {
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => value.toISOString())
  airDate?: Moment;

  @ApiProperty({ required: true, type: Number })
  episodeNumber: number;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  overview: string;

  @ApiProperty({ required: true, type: String })
  productionCode: string;

  @ApiProperty({ required: true, type: Number })
  runtime: number;

  @ApiProperty({ required: true, type: Number })
  seasonNumber: number;

  @ApiProperty({ type: String, required: false })
  stillPath?: string;

  @ApiProperty({ required: true, type: Number })
  voteCount: number;

  @ApiProperty({ required: true, type: Number })
  voteAverage: number;
}

export class SparseEpisode extends BaseEpisode {
  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
  })
  favorite?: SparseMediaFavorite;

  @ApiProperty({ type: () => MediaAsset, required: false })
  asset?: MediaAsset;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class Episode extends SparseEpisode {
  @ApiProperty({
    required: true,
    type: () => SparseTvSeries,
  })
  series: BaseTVSeries;

  @ApiProperty({ required: true, type: () => SparseSeason })
  season: SparseSeason;

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
}

export class PartialEpisode extends BaseEpisode {
  @ApiProperty({ required: true, type: Number })
  seasonId: number;

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
  })
  cast: PartialTVEpisodeCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCrewMember,
    isArray: true,
  })
  crew: PartialTVEpisodeCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
  })
  guestStars: PartialTVEpisodeCastMember[];

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

export class TVEpisodeCrewMember {
  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: String })
  job: string;

  @ApiProperty({ required: true, type: String })
  department: string;

  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;

  @ApiProperty({ required: true, type: String })
  originalName: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeCrewMember extends OmitType(TVEpisodeCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class SparseTVEpisodeCastMember {
  @ApiProperty({ required: true, type: String })
  character: string;

  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: Number })
  order: number;

  @ApiProperty({ required: true, type: String })
  originalName: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVEpisodeCastMember extends SparseTVEpisodeCastMember {
  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVEpisodeCastMember extends OmitType(TVEpisodeCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class CreateTVEpisodeRequest {
  @ApiProperty({
    required: true,
    type: () => PartialEpisode,
  })
  episode: PartialEpisode;
}

export class CreateTVEpisodeResponse {
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

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  episodeId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  episodeNumber: number;
}

export class DescribeTVEpisodeResponse {
  @ApiProperty({
    required: true,
    type: () => Episode,
  })
  episode: Episode;
}

export class ListTVEpisodeCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  cast: TVEpisodeCastMember[];
}

export class ListTVEpisodeCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCrewMember,
    isArray: true,
  })
  crew: TVEpisodeCrewMember[];
}

export class ListTVEpisodeGuestStarsResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  guestStars: TVEpisodeCastMember[];
}
