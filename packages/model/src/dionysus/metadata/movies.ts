import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import { MediaAsset, MediaAssetSearchConfiguration } from "../media";
import { Certification } from "./certifications";
import { Collection } from "./collections";
import {
  AlternativeTitle,
  ExternalId,
  LocationStatistic,
  PartialAlternativeTitle,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  RuntimeStatistic,
  StatusStatistic,
  TypedImage,
  Video,
  YearStatistic,
} from "./common";
import {
  Country,
  CountryAssociation,
  PartialCountryAssociation,
} from "./countries";
import { GenreAssociation, PartialGenreAssociation } from "./genres";
import { KeywordAssociation, PartialKeywordAssociation } from "./keywords";
import {
  Language,
  LanguageAssociation,
  PartialLanguageAssociation,
} from "./languages";
import { BasePerson } from "./people";
import {
  PartialProductionCompanyAssociation,
  ProductionCompanyAssociation,
} from "./propductionCompanies";

export class BaseMovie {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String })
  backdropPath?: string;

  @ApiProperty({ type: Number })
  budget: number;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String, required: false })
  imdbId?: string;

  @ApiProperty({ type: String })
  originalTitle: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: Number })
  popularity: number;

  @ApiProperty({ type: String, required: false })
  posterPath?: string;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  releaseDate?: Moment;

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

  @ApiProperty({ type: Number })
  voteCount: number;

  @ApiProperty({ type: Number })
  voteAverage: number;
}

export class SparseMovie extends BaseMovie {
  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({ type: () => MediaAsset, required: false })
  asset?: MediaAsset;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class Movie extends SparseMovie {
  @ApiProperty({
    type: () => AlternativeTitle,
    isArray: true,
  })
  alternativeTitles: AlternativeTitle[];

  @ApiProperty({
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    type: () => GenreAssociation,
    isArray: true,
  })
  genres: GenreAssociation[];

  @ApiProperty({
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];

  @ApiProperty({
    type: () => KeywordAssociation,
    isArray: true,
  })
  keywords: KeywordAssociation[];

  @ApiProperty({ type: Language })
  originalLanguage: Language;

  @ApiProperty({
    type: () => ProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: ProductionCompanyAssociation[];

  @ApiProperty({
    type: () => CountryAssociation,
    isArray: true,
  })
  productionCountries: CountryAssociation[];

  @ApiProperty({
    type: () => MovieReleaseDate,
    isArray: true,
  })
  releaseDates: MovieReleaseDate[];

  @ApiProperty({
    type: () => LanguageAssociation,
    isArray: true,
  })
  spokenLanguages: LanguageAssociation[];

  @ApiProperty({
    type: () => Video,
    isArray: true,
  })
  videos: Video[];
}

export class MovieWithCredits extends Movie {
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
}

export class PartialMovie extends BaseMovie {
  @ApiProperty({ type: () => String })
  originalLanguageCode: string;

  @ApiProperty({
    type: () => PartialAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialAlternativeTitle[];

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
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    type: () => PartialGenreAssociation,
    isArray: true,
  })
  genres: PartialGenreAssociation[];

  @ApiProperty({
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];

  @ApiProperty({
    type: () => PartialKeywordAssociation,
    isArray: true,
  })
  keywords: PartialKeywordAssociation[];

  @ApiProperty({
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  productionCountries: PartialCountryAssociation[];

  @ApiProperty({
    type: () => PartialMovieRecommendation,
    isArray: true,
  })
  recommendations: PartialMovieRecommendation[];

  @ApiProperty({
    type: () => PartialMovieReleaseDate,
    isArray: true,
  })
  releaseDates: PartialMovieReleaseDate[];

  @ApiProperty({
    type: () => PartialLanguageAssociation,
    isArray: true,
  })
  spokenLanguages: PartialLanguageAssociation[];

  @ApiProperty({
    type: () => PartialVideo,
    isArray: true,
  })
  videos: PartialVideo[];
}

export class SparseMovieCastMember {
  @ApiProperty({ type: Number })
  castId: number;

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

export class MovieCastMember extends SparseMovieCastMember {
  @ApiProperty({ type: BasePerson })
  person: BasePerson;
}

export class PartialMovieCastMember extends OmitType(MovieCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class SparseMovieCrewMember {
  @ApiProperty({ type: String })
  creditId: string;

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

export class MovieCrewMember extends SparseMovieCrewMember {
  @ApiProperty({ type: BasePerson })
  person: BasePerson;
}

export class PartialMovieCrewMember extends OmitType(MovieCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class MovieReleaseDate {
  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: Language })
  language?: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  releaseDate?: Moment;

  @ApiProperty({ type: Number })
  type: number;

  @ApiProperty({ type: String })
  note: string;

  @ApiProperty({ type: Certification })
  certification?: Certification;

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
  countryCode: string;

  @ApiProperty({ type: String })
  languageCode: string;

  @ApiProperty({ type: String })
  certificationId: string;
}

export class MovieRecommendation {
  @ApiProperty({
    type: () => SparseMovie,
  })
  movie: SparseMovie;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieRecommendation {
  @ApiProperty({ type: Number })
  recommendationId: number;
}

export class CreateMovieRequest {
  @ApiProperty({
    type: () => PartialMovie,
  })
  movie: PartialMovie;
}

export class CreateMovieResponse {
  @ApiProperty({
    type: () => SparseMovie,
  })
  movie: SparseMovie;
}

export class DescribeMovieResponse {
  @ApiProperty({
    type: () => Movie,
  })
  movie: Movie;
}

export class ListMoviesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => SparseMovie,
    isArray: true,
  })
  movies: SparseMovie[];
}

export class ListMovieCastResponse {
  @ApiProperty({
    type: () => MovieCastMember,
    isArray: true,
  })
  cast: MovieCastMember[];
}

export class ListMovieCrewResponse {
  @ApiProperty({
    type: () => MovieCrewMember,
    isArray: true,
  })
  crew: MovieCrewMember[];
}

export class ListMovieRecommendationsResponse {
  @ApiProperty({
    type: () => SparseMovie,
    isArray: true,
  })
  recommendations: SparseMovie[];
}

export class ListMovieCollectionsResponse {
  @ApiProperty({
    type: () => Collection,
    isArray: true,
  })
  collections: Collection[];
}

export class GetMovieLocationStatisticsResponse {
  @ApiProperty({
    type: () => LocationStatistic,
    isArray: true,
  })
  statistics: LocationStatistic[];
}

export class GetMovieReleaseStatusStatisticsResponse {
  @ApiProperty({
    type: () => StatusStatistic,
    isArray: true,
  })
  statistics: StatusStatistic[];
}

export class GetMovieReleaseYearStatisticsResponse {
  @ApiProperty({
    type: () => YearStatistic,
    isArray: true,
  })
  statistics: YearStatistic[];
}

export class GetMovieRuntimeStatisticsResponse {
  @ApiProperty({
    type: () => RuntimeStatistic,
    isArray: true,
  })
  statistics: RuntimeStatistic[];
}

export class GetMovieAggregateStatisticsResponse {
  @ApiProperty({ type: Number })
  count: number;

  @ApiProperty({ type: Number })
  averageBudget: number;

  @ApiProperty({ type: Number })
  averageRevenue: number;

  @ApiProperty({ type: Number })
  maxRevenue: number;

  @ApiProperty({ type: Number })
  averageRuntime: number;
}
