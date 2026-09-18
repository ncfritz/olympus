import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { Country } from "./countries";
import { Language } from "./languages";

export class ExternalId {
  @ApiProperty({
    required: true,
    type: String,
    description: "The source of the ID, e.g. imdb or tvdb",
  })
  type: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The ID in the external source",
  })
  externalId: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the external id was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the external id was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialExternalId extends OmitType(ExternalId, [
  ...AUDIT_FIELDS,
]) {}

export class AlternativeTitle {
  @ApiProperty({
    required: true,
    type: String,
    description: "The alternative title",
  })
  title: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The kind of alternative title, e.g. working title",
  })
  type: string;

  @ApiProperty({
    required: true,
    type: Country,
    description: "The country where the title is used",
  })
  country: Country;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the alternative title was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the alternative title was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialAlternativeTitle extends OmitType(AlternativeTitle, [
  ...AUDIT_FIELDS,
  "country",
]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country",
  })
  countryCode: string;
}

export class AlternativeName {
  @ApiProperty({
    required: true,
    type: String,
    description: "The alternative name",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The kind of alternative name, e.g. abbreviation",
  })
  type: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the alternative name was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the alternative name was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialAlternativeName extends OmitType(AlternativeName, [
  ...AUDIT_FIELDS,
]) {}

export class BaseImage {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The width in pixels",
  })
  width: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The height in pixels",
  })
  height: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB path of the image file",
  })
  filePath: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the image was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the image was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialBaseImage extends OmitType(BaseImage, [...AUDIT_FIELDS]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 639-1 code of the language",
  })
  languageCode: string;
}

export class TypedImage extends BaseImage {
  @ApiProperty({
    required: true,
    type: String,
    description: "The kind of image, e.g. poster, backdrop or logo",
  })
  type: string;

  @ApiProperty({
    required: false,
    type: Language,
    description: "The language of any text in the image",
  })
  language?: Language;
}

export class PartialTypedImage extends OmitType(TypedImage, [
  ...AUDIT_FIELDS,
  "language",
]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 639-1 code of the language",
  })
  languageCode: string;
}

export class IdentifiableImage extends BaseImage {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the image",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The image file type, e.g. .png or .svg",
  })
  fileType: string;
}

export class PartialIdentifiableImage extends OmitType(IdentifiableImage, [
  ...AUDIT_FIELDS,
]) {}

export class Video {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the video",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: Country,
    description: "The country the video is intended for",
  })
  country: Country;

  @ApiProperty({
    required: true,
    type: Language,
    description: "The language of the video",
  })
  language: Language;

  @ApiProperty({
    required: true,
    type: String,
    description: "The title of the video",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description:
      "The video's key on the hosting site (e.g. the YouTube video ID)",
  })
  key: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The site hosting the video, e.g. YouTube",
  })
  site: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The vertical resolution of the video, e.g. 1080",
  })
  size: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The kind of video, e.g. Trailer, Teaser or Featurette",
  })
  type: string;

  @ApiProperty({
    required: true,
    type: Boolean,
    description: "Whether the video was published by the studio or network",
  })
  official: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the video was published",
  })
  publishedTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the video was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the video was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialVideo extends OmitType(Video, [
  ...AUDIT_FIELDS,
  "language",
  "country",
]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country",
  })
  countryCode: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 639-1 code of the language",
  })
  languageCode: string;
}

export class LocationStatistic {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country",
  })
  countryCode: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles from the country",
  })
  count: number;
}

export class StatusStatistic {
  @ApiProperty({ required: true, type: String, description: "The status" })
  status: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles with the status",
  })
  count: number;
}

export class YearStatistic {
  @ApiProperty({ required: true, type: Number, description: "The year" })
  year: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles in the year",
  })
  count: number;
}

export class RuntimeStatistic {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The runtime bucket in minutes",
  })
  runtime: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The runtime formatted for display, e.g. 1h 30m",
  })
  label: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles in the runtime bucket",
  })
  count: number;
}

export class SeasonStatistic {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of seasons",
  })
  seasons: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of TV series with that many seasons",
  })
  count: number;
}

export class GenreCountStatistic {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of genres",
  })
  genres: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles with that many genres",
  })
  count: number;
}

export class GenreStatistic {
  @ApiProperty({ required: true, type: String, description: "The genre name" })
  genre: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of titles in the genre",
  })
  count: number;
}
