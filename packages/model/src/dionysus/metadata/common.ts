import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Country } from "./countries";
import { Language } from "./languages";

export class ExternalId {
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

export class PartialExternalId extends OmitType(ExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class AlternativeTitle {
  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialAlternativeTitle extends OmitType(AlternativeTitle, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class AlternativeName {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialAlternativeName extends OmitType(AlternativeName, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class BaseImage {
  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;

  @ApiProperty({ type: String })
  filePath: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialBaseImage extends OmitType(BaseImage, [
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ type: String })
  languageCode: string;
}

export class TypedImage extends BaseImage {
  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: Language })
  language?: Language;
}

export class PartialTypedImage extends OmitType(TypedImage, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ type: String })
  languageCode: string;
}

export class IdentifiableImage extends BaseImage {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  fileType: string;
}

export class PartialIdentifiableImage extends OmitType(IdentifiableImage, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class Video {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  key: string;

  @ApiProperty({ type: String })
  site: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: Boolean })
  official: boolean;

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

export class PartialVideo extends OmitType(Video, [
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

export class LocationStatistic {
  @ApiProperty({ type: String })
  countryCode: string;

  @ApiProperty({ type: Number })
  count: number;
}

export class StatusStatistic {
  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: Number })
  count: number;
}

export class YearStatistic {
  @ApiProperty({ type: Number })
  year: number;

  @ApiProperty({ type: Number })
  count: number;
}

export class RuntimeStatistic {
  @ApiProperty({ type: Number })
  runtime: number;

  @ApiProperty({ type: String })
  label: string;

  @ApiProperty({ type: Number })
  count: number;
}

export class SeasonStatistic {
  @ApiProperty({ type: Number })
  seasons: number;

  @ApiProperty({ type: Number })
  count: number;
}
