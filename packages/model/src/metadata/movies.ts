import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { Certification } from "./certifications";
import { Country } from "./countries";
import { Genre } from "./genres";
import { Keyword } from "./keywords";
import { Language } from "./languages";
import { Person } from "./people";
import { ProductionCompany } from "./propductionCompanies";

export class BaseMovie {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String })
  backdropPath: string;

  @ApiProperty({ type: Number })
  budget: number;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String })
  imdbId: string;

  @ApiProperty({ type: Language })
  originalLanguage: Language;

  @ApiProperty({ type: String })
  originalTitle: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  posterPath?: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  releaseDate: Moment;

  @ApiProperty({ type: Number })
  revenue: number;

  @ApiProperty({ type: Number })
  runtime: number;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: String })
  tagline: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: Boolean })
  video: boolean;
}

export class Movie extends BaseMovie {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => MovieAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: MovieAlternativeTitle[];

  @ApiProperty({
    type: () => MovieCastMember,
    isArray: true,
  })
  cast: MovieCastMember[];

  @ApiProperty({
    type: () => MovieCrewMember,
    isArray: true,
  })
  crew: MovieCrewMember[];

  @ApiProperty({
    type: () => MovieExternalId,
    isArray: true,
  })
  externalIds: MovieExternalId[];

  @ApiProperty({
    type: () => MovieGenre,
    isArray: true,
  })
  genres: MovieGenre[];

  @ApiProperty({
    type: () => MovieImage,
    isArray: true,
  })
  images: MovieImage[];

  @ApiProperty({
    type: () => MovieKeyword,
    isArray: true,
  })
  keywords: MovieKeyword[];

  @ApiProperty({
    type: () => MovieProductionCompany,
    isArray: true,
  })
  productionCompanies: MovieProductionCompany[];

  @ApiProperty({
    type: () => MovieProductionCountry,
    isArray: true,
  })
  productionCountries: MovieProductionCountry[];

  @ApiProperty({
    type: () => MovieReleaseDate,
    isArray: true,
  })
  releaseDates: MovieReleaseDate[];

  @ApiProperty({
    type: () => MovieSpokenLanguage,
    isArray: true,
  })
  spokenLanguages: MovieSpokenLanguage[];

  @ApiProperty({
    type: () => MovieVideo,
    isArray: true,
  })
  videos: MovieVideo[];
}

export class PartialMovie extends BaseMovie {
  @ApiProperty({ type: () => String })
  originalLanguageCode: string;

  @ApiProperty({
    type: () => PartialMovieAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialMovieAlternativeTitle[];

  @ApiProperty({
    type: () => PartialMovieCastMember,
    isArray: true,
  })
  cast: PartialMovieCastMember[];

  @ApiProperty({
    type: () => PartialMovieCrewMember,
    isArray: true,
  })
  crew: PartialMovieCrewMember[];

  @ApiProperty({
    type: () => PartialMovieExternalId,
    isArray: true,
  })
  externalIds: PartialMovieExternalId[];

  @ApiProperty({
    type: () => PartialMovieGenre,
    isArray: true,
  })
  genres: PartialMovieGenre[];

  @ApiProperty({
    type: () => PartialMovieImage,
    isArray: true,
  })
  images: PartialMovieImage[];

  @ApiProperty({
    type: () => PartialMovieKeyword,
    isArray: true,
  })
  keywords: PartialMovieKeyword[];

  @ApiProperty({
    type: () => PartialMovieProductionCompany,
    isArray: true,
  })
  productionCompanies: PartialMovieProductionCompany[];

  @ApiProperty({
    type: () => PartialMovieProductionCountry,
    isArray: true,
  })
  productionCountries: PartialMovieProductionCountry[];

  @ApiProperty({
    type: () => PartialMovieReleaseDate,
    isArray: true,
  })
  releaseDates: PartialMovieReleaseDate[];

  @ApiProperty({
    type: () => PartialMovieSpokenLanguage,
    isArray: true,
  })
  spokenLanguages: PartialMovieSpokenLanguage[];

  @ApiProperty({
    type: () => PartialMovieVideo,
    isArray: true,
  })
  videos: PartialMovieVideo[];
}

export class MovieExternalId {
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

export class PartialMovieExternalId extends OmitType(MovieExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class MovieAlternativeTitle {
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

export class PartialMovieAlternativeTitle extends OmitType(
  MovieAlternativeTitle,
  ["createdTime", "lastUpdatedTime", "country"],
) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class MovieCastMember {
  @ApiProperty({ type: String })
  castId: number;

  @ApiProperty({ type: Person })
  person: Person;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  character: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieCastMember extends OmitType(MovieCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class MovieCrewMember {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: Person })
  person: Person;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: String })
  department: string;

  @ApiProperty({ type: String })
  job: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieCrewMember extends OmitType(MovieCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class MovieGenre {
  @ApiProperty({ type: Genre })
  genre: Genre;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieGenre extends OmitType(MovieGenre, [
  "createdTime",
  "lastUpdatedTime",
  "genre",
]) {
  @ApiProperty({ type: Number })
  genreId: number;
}

export class MovieImage {
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

export class PartialMovieImage extends OmitType(MovieImage, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class MovieKeyword {
  @ApiProperty({ type: Keyword })
  keyword: Keyword;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieKeyword extends OmitType(MovieKeyword, [
  "createdTime",
  "lastUpdatedTime",
  "keyword",
]) {
  @ApiProperty({ type: Number })
  keywordId: number;
}

export class MovieProductionCompany {
  @ApiProperty({ type: ProductionCompany })
  productionCompany: ProductionCompany;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieProductionCompany extends OmitType(
  MovieProductionCompany,
  ["createdTime", "lastUpdatedTime", "productionCompany"],
) {
  @ApiProperty({ type: Number })
  productionCompanyId: number;
}

export class MovieProductionCountry {
  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieProductionCountry extends OmitType(
  MovieProductionCountry,
  ["createdTime", "lastUpdatedTime", "country"],
) {
  @ApiProperty({ type: String })
  countryId: string;
}

export class MovieReleaseDate {
  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  releaseDate: Moment;

  @ApiProperty({ type: Number })
  type: number;

  @ApiProperty({ type: String })
  note: string;

  @ApiProperty({ type: Certification })
  certification: Certification;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieReleaseDate extends OmitType(MovieReleaseDate, [
  "createdTime",
  "lastUpdatedTime",
  "country",
  "language",
  "certification",
]) {
  @ApiProperty({ type: String })
  countryId: string;

  @ApiProperty({ type: String })
  languageId: string;

  @ApiProperty({ type: String })
  certificationId: string;
}

export class MovieSpokenLanguage {
  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieSpokenLanguage extends OmitType(MovieSpokenLanguage, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ type: String })
  languageId: string;
}

export class MovieVideo {
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

export class PartialMovieVideo extends OmitType(MovieVideo, [
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

export class CreateMovieRequest {
  @ApiProperty({
    type: () => PartialMovie,
  })
  movie: PartialMovie;
}

export class CreateMovieResponse {
  @ApiProperty({
    type: () => Movie,
  })
  movie: Movie;
}
