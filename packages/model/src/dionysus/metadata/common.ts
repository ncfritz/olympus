import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Country } from "./countries";
import { Language } from "./languages";

export class ExternalId {
  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: true, type: String })
  externalId: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialExternalId extends OmitType(ExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class AlternativeTitle {
  @ApiProperty({ required: true, type: String })
  title: string;

  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: true, type: Country })
  country: Country;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialAlternativeTitle extends OmitType(AlternativeTitle, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ required: true, type: String })
  countryCode: string;
}

export class AlternativeName {
  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialAlternativeName extends OmitType(AlternativeName, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class BaseImage {
  @ApiProperty({ required: true, type: Number })
  width: number;

  @ApiProperty({ required: true, type: Number })
  height: number;

  @ApiProperty({ required: true, type: String })
  filePath: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialBaseImage extends OmitType(BaseImage, [
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ required: true, type: String })
  languageCode: string;
}

export class TypedImage extends BaseImage {
  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: false, type: Language })
  language?: Language;
}

export class PartialTypedImage extends OmitType(TypedImage, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ required: true, type: String })
  languageCode: string;
}

export class IdentifiableImage extends BaseImage {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  fileType: string;
}

export class PartialIdentifiableImage extends OmitType(IdentifiableImage, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class Video {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: Country })
  country: Country;

  @ApiProperty({ required: true, type: Language })
  language: Language;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  key: string;

  @ApiProperty({ required: true, type: String })
  site: string;

  @ApiProperty({ required: true, type: Number })
  size: number;

  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: true, type: Boolean })
  official: boolean;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  publishedTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialVideo extends OmitType(Video, [
  "createdTime",
  "lastUpdatedTime",
  "language",
  "country",
]) {
  @ApiProperty({ required: true, type: String })
  countryCode: string;

  @ApiProperty({ required: true, type: String })
  languageCode: string;
}

export class LocationStatistic {
  @ApiProperty({ required: true, type: String })
  countryCode: string;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class StatusStatistic {
  @ApiProperty({ required: true, type: String })
  status: string;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class YearStatistic {
  @ApiProperty({ required: true, type: Number })
  year: number;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class RuntimeStatistic {
  @ApiProperty({ required: true, type: Number })
  runtime: number;

  @ApiProperty({ required: true, type: String })
  label: string;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class SeasonStatistic {
  @ApiProperty({ required: true, type: Number })
  seasons: number;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class GenreCountStatistic {
  @ApiProperty({ required: true, type: Number })
  genres: number;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class GenreStatistic {
  @ApiProperty({ required: true, type: String })
  genre: string;

  @ApiProperty({ required: true, type: Number })
  count: number;
}
