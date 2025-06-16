import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { Country } from "./countries";
import { Language } from "./languages";
import { Person } from "./people";
import { Season } from "./tvSeason";

export class BaseEpisode {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  airDate: Moment;

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

  @ApiProperty({ type: String })
  stillPath?: string;
}

export class Episode extends BaseEpisode {
  @ApiProperty({ type: Season })
  season: Season;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  cast: TVEpisodeCastMember[];

  @ApiProperty({
    type: () => TVEpisodeCrewMember,
    isArray: true,
  })
  crew: TVEpisodeCrewMember[];

  @ApiProperty({
    type: () => TVEpisodeExternalId,
    isArray: true,
  })
  externalIds: TVEpisodeExternalId[];

  @ApiProperty({
    type: () => TVEpisodeCastMember,
    isArray: true,
  })
  guestStars: TVEpisodeCastMember[];

  @ApiProperty({
    type: () => TVEpisodeImage,
    isArray: true,
  })
  images: TVEpisodeImage[];

  @ApiProperty({
    type: () => TVEpisodeVideo,
    isArray: true,
  })
  videos: TVEpisodeVideo[];
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
    type: () => PartialTVEpisodeExternalId,
    isArray: true,
  })
  externalIds: PartialTVEpisodeExternalId[];

  @ApiProperty({
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
  })
  guestStars: PartialTVEpisodeCastMember[];

  @ApiProperty({
    type: () => PartialTVEpisodeImage,
    isArray: true,
  })
  images: PartialTVEpisodeImage[];

  @ApiProperty({
    type: () => PartialTVEpisodeVideo,
    isArray: true,
  })
  videos: PartialTVEpisodeVideo[];
}

export class TVEpisodeExternalId {
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

export class PartialTVEpisodeExternalId extends OmitType(TVEpisodeExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class TVEpisodeCrewMember {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: String })
  job: string;

  @ApiProperty({ type: String })
  department: string;

  @ApiProperty({ type: Person })
  person: Person;

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

export class TVEpisodeCastMember {
  @ApiProperty({ type: String })
  character: string;

  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: Person })
  person: Person;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeCastMember extends OmitType(TVEpisodeCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class TVEpisodeImage {
  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  filePath: string;

  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeImage extends OmitType(TVEpisodeImage, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class TVEpisodeVideo {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: Boolean })
  official: boolean;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  key: string;

  @ApiProperty({ type: String })
  site: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  publishedTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeVideo extends OmitType(TVEpisodeVideo, [
  "createdTime",
  "lastUpdatedTime",
  "language",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;

  @ApiProperty({ type: String })
  languageCode: string;
}

export class CreateTVEpisodeRequest {
  @ApiProperty({
    type: () => PartialEpisode,
  })
  episode: PartialEpisode;
}

export class CreateTVEpisodeResponse {
  @ApiProperty({
    type: () => Episode,
  })
  episode: Episode;
}
