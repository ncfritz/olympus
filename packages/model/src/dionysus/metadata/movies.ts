import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import {
  MediaAsset,
  MediaAssetSearchConfiguration,
  SparseMediaFavorite,
} from "../media";
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
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: Boolean })
  adult: boolean;

  @ApiProperty({ required: false, type: String })
  backdropPath?: string;

  @ApiProperty({ required: true, type: Number })
  budget: number;

  @ApiProperty({ required: true, type: String })
  homepage: string;

  @ApiProperty({ type: String, required: false })
  imdbId?: string;

  @ApiProperty({ required: true, type: String })
  originalTitle: string;

  @ApiProperty({ required: true, type: String })
  overview: string;

  @ApiProperty({ required: true, type: Number })
  popularity: number;

  @ApiProperty({ type: String, required: false })
  posterPath?: string;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  releaseDate?: Moment;

  @ApiProperty({ required: true, type: Number })
  revenue: number;

  @ApiProperty({ required: true, type: Number })
  runtime: number;

  @ApiProperty({ required: true, type: String })
  status: string;

  @ApiProperty({ required: true, type: String })
  tagline: string;

  @ApiProperty({ required: true, type: String })
  title: string;

  @ApiProperty({ required: true, type: Boolean })
  video: boolean;

  @ApiProperty({ required: true, type: Number })
  voteCount: number;

  @ApiProperty({ required: true, type: Number })
  voteAverage: number;
}

export class SparseMovie extends BaseMovie {
  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({ type: () => MediaAsset, required: false })
  asset?: MediaAsset;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => GenreAssociation,
    isArray: true,
  })
  genres: GenreAssociation[];

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
  })
  favorite?: SparseMediaFavorite;
}

export class Movie extends SparseMovie {
  @ApiProperty({
    required: true,
    type: () => AlternativeTitle,
    isArray: true,
  })
  alternativeTitles: AlternativeTitle[];

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
    type: () => KeywordAssociation,
    isArray: true,
  })
  keywords: KeywordAssociation[];

  @ApiProperty({ required: true, type: Language })
  originalLanguage: Language;

  @ApiProperty({
    required: true,
    type: () => ProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: ProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => CountryAssociation,
    isArray: true,
  })
  productionCountries: CountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => MovieReleaseDate,
    isArray: true,
  })
  releaseDates: MovieReleaseDate[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
  })
  spokenLanguages: LanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
  })
  videos: Video[];
}

export class MovieWithCredits extends Movie {
  @ApiProperty({
    required: true,
    type: () => MovieCastMember,
    isArray: true,
  })
  cast: MovieCastMember[];

  @ApiProperty({
    required: true,
    type: () => MovieCrewMember,
    isArray: true,
  })
  crew: MovieCrewMember[];
}

export class PartialMovie extends BaseMovie {
  @ApiProperty({ required: true, type: () => String })
  originalLanguageCode: string;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialAlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieCastMember,
    isArray: true,
  })
  cast: PartialMovieCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieCrewMember,
    isArray: true,
  })
  crew: PartialMovieCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialGenreAssociation,
    isArray: true,
  })
  genres: PartialGenreAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];

  @ApiProperty({
    required: true,
    type: () => PartialKeywordAssociation,
    isArray: true,
  })
  keywords: PartialKeywordAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  productionCountries: PartialCountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieRecommendation,
    isArray: true,
  })
  recommendations: PartialMovieRecommendation[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieReleaseDate,
    isArray: true,
  })
  releaseDates: PartialMovieReleaseDate[];

  @ApiProperty({
    required: true,
    type: () => PartialLanguageAssociation,
    isArray: true,
  })
  spokenLanguages: PartialLanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialVideo,
    isArray: true,
  })
  videos: PartialVideo[];
}

export class SparseMovieCastMember {
  @ApiProperty({ required: true, type: Number })
  castId: number;

  @ApiProperty({ required: true, type: String })
  originalName: string;

  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: Number })
  order: number;

  @ApiProperty({ required: true, type: String })
  character: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class MovieCastMember extends SparseMovieCastMember {
  @ApiProperty({ required: true, type: BasePerson })
  person: BasePerson;
}

export class PartialMovieCastMember extends OmitType(MovieCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class SparseMovieCrewMember {
  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: String })
  originalName: string;

  @ApiProperty({ required: true, type: String })
  department: string;

  @ApiProperty({ required: true, type: String })
  job: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class MovieCrewMember extends SparseMovieCrewMember {
  @ApiProperty({ required: true, type: BasePerson })
  person: BasePerson;
}

export class PartialMovieCrewMember extends OmitType(MovieCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class MovieReleaseDate {
  @ApiProperty({ required: true, type: Country })
  country: Country;

  @ApiProperty({ required: false, type: Language })
  language?: Language;

  @ApiProperty({ required: false, type: String })
  @Transform(({ value }) => value.toISOString())
  releaseDate?: Moment;

  @ApiProperty({ required: true, type: Number })
  type: number;

  @ApiProperty({ required: true, type: String })
  note: string;

  @ApiProperty({ required: false, type: Certification })
  certification?: Certification;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
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
  @ApiProperty({ required: true, type: String })
  countryCode: string;

  @ApiProperty({ required: true, type: String })
  languageCode: string;

  @ApiProperty({ required: true, type: String })
  certificationId: string;
}

export class MovieRecommendation {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
  })
  movie: SparseMovie;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialMovieRecommendation {
  @ApiProperty({ required: true, type: Number })
  recommendationId: number;
}

export class CreateMovieRequest {
  @ApiProperty({
    required: true,
    type: () => PartialMovie,
  })
  movie: PartialMovie;
}

export class CreateMovieResponse {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
  })
  movie: SparseMovie;
}

export class DescribeMovieResponse {
  @ApiProperty({
    required: true,
    type: () => Movie,
  })
  movie: Movie;
}

export class ListMoviesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    isArray: true,
  })
  movies: SparseMovie[];
}

export class ListMovieCastResponse {
  @ApiProperty({
    required: true,
    type: () => MovieCastMember,
    isArray: true,
  })
  cast: MovieCastMember[];
}

export class ListMovieCrewResponse {
  @ApiProperty({
    required: true,
    type: () => MovieCrewMember,
    isArray: true,
  })
  crew: MovieCrewMember[];
}

export class ListMovieRecommendationsResponse {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    isArray: true,
  })
  recommendations: SparseMovie[];
}

export class ListMovieCollectionsResponse {
  @ApiProperty({
    required: true,
    type: () => Collection,
    isArray: true,
  })
  collections: Collection[];
}

export class GetMovieLocationStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => LocationStatistic,
    isArray: true,
  })
  statistics: LocationStatistic[];
}

export class GetMovieReleaseStatusStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => StatusStatistic,
    isArray: true,
  })
  statistics: StatusStatistic[];
}

export class GetMovieReleaseYearStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => YearStatistic,
    isArray: true,
  })
  statistics: YearStatistic[];
}

export class GetMovieRuntimeStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => RuntimeStatistic,
    isArray: true,
  })
  statistics: RuntimeStatistic[];
}

export class GetMovieAggregateStatisticsResponse {
  @ApiProperty({ required: true, type: Number })
  count: number;

  @ApiProperty({ required: true, type: Number })
  averageBudget: number;

  @ApiProperty({ required: true, type: Number })
  averageRevenue: number;

  @ApiProperty({ required: true, type: Number })
  maxRevenue: number;

  @ApiProperty({ required: true, type: Number })
  averageRuntime: number;
}
