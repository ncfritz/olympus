import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { Country } from "./countries";
import { Language } from "./languages";
import { Person } from "./people";
import { Season } from "./tvSeason";
import { TVSeries } from "./tvSeries";

export class BaseEpisode {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: TVSeries })
  series: TVSeries;

  @ApiProperty({ type: Season })
  season: Season;

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
  stillPath: string;
}

export class Episode extends BaseEpisode {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => TVEpisodeExternalId,
    isArray: true,
  })
  externalIds: TVEpisodeExternalId[];

  @ApiProperty({
    type: () => TVEpisodeGuestStar,
    isArray: true,
  })
  guestStars: TVEpisodeGuestStar[];

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
  @ApiProperty({
    type: () => PartialTVEpisodeExternalId,
    isArray: true,
  })
  externalIds: PartialTVEpisodeExternalId[];

  @ApiProperty({
    type: () => PartialTVEpisodeGuestStar,
    isArray: true,
  })
  guestStars: PartialTVEpisodeGuestStar[];

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

export class TVEpisodeGuestStar {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: Person })
  person: Person;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  character: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeGuestStar extends OmitType(TVEpisodeGuestStar, [
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
  filePath: string;

  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;

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
  countryId: string;

  @ApiProperty({ type: String })
  languageId: string;
}
