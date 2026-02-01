import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { MediaAssetSearchConfiguration } from "../media";
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
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => value.toISOString())
  airDate?: Moment;

  @ApiProperty({ type: Number })
  episodeNumber: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  productionCode: string;

  @ApiProperty({ type: Number })
  runtime: number;

  @ApiProperty({ type: Number })
  seasonNumber: number;

  @ApiProperty({ type: String, required: false })
  stillPath?: string;

  @ApiProperty({ type: Number })
  voteCount: number;

  @ApiProperty({ type: Number })
  voteAverage: number;
}

export class SparseEpisode extends BaseEpisode {
  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class Episode extends SparseEpisode {
  @ApiProperty({
    type: () => SparseTvSeries,
  })
  series: BaseTVSeries;

  @ApiProperty({ type: () => SparseSeason })
  season: SparseSeason;

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
}

export class PartialEpisode extends BaseEpisode {
  @ApiProperty({ type: Number })
  seasonId: number;

  @ApiProperty({
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
  })
  cast: PartialTVEpisodeCastMember[];

  @ApiProperty({
    type: () => PartialTVEpisodeCrewMember,
    isArray: true,
  })
  crew: PartialTVEpisodeCrewMember[];

  @ApiProperty({
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
  })
  guestStars: PartialTVEpisodeCastMember[];

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

export class TVEpisodeCrewMember {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: String })
  job: string;

  @ApiProperty({ type: String })
  department: string;

  @ApiProperty({ type: () => BasePerson })
  person: BasePerson;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeCrewMember extends OmitType(TVEpisodeCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class SparseTVEpisodeCastMember {
  @ApiProperty({ type: String })
  character: string;

  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVEpisodeCastMember extends SparseTVEpisodeCastMember {
  @ApiProperty({ type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVEpisodeCastMember extends OmitType(TVEpisodeCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class CreateTVEpisodeRequest {
  @ApiProperty({
    type: () => PartialEpisode,
  })
  episode: PartialEpisode;
}

export class CreateTVEpisodeResponse {
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

  @ApiProperty({
    type: () => Number,
  })
  episodeId: number;

  @ApiProperty({
    type: () => Number,
  })
  episodeNumber: number;
}

export class DescribeTVEpisodeResponse {
  @ApiProperty({
    type: () => Episode,
  })
  episode: Episode;
}

export class ListTVEpisodeCastResponse {
  @ApiProperty({
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  cast: TVEpisodeCastMember[];
}

export class ListTVEpisodeCrewResponse {
  @ApiProperty({
    type: () => TVEpisodeCrewMember,
    isArray: true,
  })
  crew: TVEpisodeCrewMember[];
}

export class ListTVEpisodeGuestStarsResponse {
  @ApiProperty({
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  guestStars: TVEpisodeCastMember[];
}
