import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the movie",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: Boolean,
    description: "Whether the movie is flagged as adult content",
  })
  adult: boolean;

  @ApiProperty({
    required: false,
    type: String,
    description: "The TMDB path of the backdrop image",
  })
  backdropPath?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The production budget in US dollars",
  })
  budget: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The URL of the official homepage",
  })
  homepage: string;

  @ApiProperty({ type: String, required: false, description: "The IMDb ID" })
  imdbId?: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The title in the original language",
  })
  originalTitle: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "A summary of the movie",
  })
  overview: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB popularity score",
  })
  popularity: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The TMDB path of the poster image",
  })
  posterPath?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating the primary release date",
  })
  releaseDate?: Moment;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The box office revenue in US dollars",
  })
  revenue: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The runtime in minutes",
  })
  runtime: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The release status, e.g. Released or In Production",
  })
  status: string;

  @ApiProperty({ required: true, type: String, description: "The tagline" })
  tagline: string;

  @ApiProperty({ required: true, type: String, description: "The title" })
  title: string;

  @ApiProperty({
    required: true,
    type: Boolean,
    description:
      "TMDB's video flag: whether the entry is a video release rather than a film",
  })
  video: boolean;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of TMDB user ratings",
  })
  voteCount: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average TMDB user rating, from 0 to 10",
  })
  voteAverage: number;
}

export class SparseMovie extends BaseMovie {
  @ApiProperty({
    type: () => MediaAssetSearchConfiguration,
    required: false,
    description:
      "The media search configuration for the movie, if there is one",
  })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => MediaAsset,
    required: false,
    description:
      "The media asset in the library for the movie, if there is one",
  })
  asset?: MediaAsset;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => GenreAssociation,
    isArray: true,
    description: "The genres of the movie",
  })
  genres: GenreAssociation[];

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
    description: "The favorite record, if the movie is marked as a favorite",
  })
  favorite?: SparseMediaFavorite;
}

export class Movie extends SparseMovie {
  @ApiProperty({
    required: true,
    type: () => AlternativeTitle,
    isArray: true,
    description: "Alternative titles, such as working or regional titles",
  })
  alternativeTitles: AlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
    description:
      "IDs of the movie in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
    description: "Images of the movie",
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => KeywordAssociation,
    isArray: true,
    description: "The keywords associated with the movie",
  })
  keywords: KeywordAssociation[];

  @ApiProperty({
    required: true,
    type: Language,
    description: "The original language",
  })
  originalLanguage: Language;

  @ApiProperty({
    required: true,
    type: () => ProductionCompanyAssociation,
    isArray: true,
    description: "The production companies",
  })
  productionCompanies: ProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => CountryAssociation,
    isArray: true,
    description: "The countries the movie was produced in",
  })
  productionCountries: CountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => MovieReleaseDate,
    isArray: true,
    description: "Release dates by country",
  })
  releaseDates: MovieReleaseDate[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
    description: "The languages spoken in the movie",
  })
  spokenLanguages: LanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: Video[];
}

export class MovieWithCredits extends Movie {
  @ApiProperty({
    required: true,
    type: () => MovieCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: MovieCastMember[];

  @ApiProperty({
    required: true,
    type: () => MovieCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: MovieCrewMember[];
}

export class PartialMovie extends BaseMovie {
  @ApiProperty({
    required: true,
    type: () => String,
    description: "The ISO 639-1 code of the original language",
  })
  originalLanguageCode: string;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeTitle,
    isArray: true,
    description: "Alternative titles, such as working or regional titles",
  })
  alternativeTitles: PartialAlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: PartialMovieCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: PartialMovieCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
    description:
      "IDs of the movie in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialGenreAssociation,
    isArray: true,
    description: "The genres of the movie",
  })
  genres: PartialGenreAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
    description: "Images of the movie",
  })
  images: PartialTypedImage[];

  @ApiProperty({
    required: true,
    type: () => PartialKeywordAssociation,
    isArray: true,
    description: "The keywords associated with the movie",
  })
  keywords: PartialKeywordAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
    description: "The production companies",
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
    description: "The countries the movie was produced in",
  })
  productionCountries: PartialCountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieRecommendation,
    isArray: true,
    description: "Recommended similar titles",
  })
  recommendations: PartialMovieRecommendation[];

  @ApiProperty({
    required: true,
    type: () => PartialMovieReleaseDate,
    isArray: true,
    description: "Release dates by country",
  })
  releaseDates: PartialMovieReleaseDate[];

  @ApiProperty({
    required: true,
    type: () => PartialLanguageAssociation,
    isArray: true,
    description: "The languages spoken in the movie",
  })
  spokenLanguages: PartialLanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialVideo,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: PartialVideo[];
}

export class SparseMovieCastMember {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB cast ID of the credit",
  })
  castId: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The billing order in the credits",
  })
  order: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the character played",
  })
  character: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie cast member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie cast member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class MovieCastMember extends SparseMovieCastMember {
  @ApiProperty({
    required: true,
    type: BasePerson,
    description: "The credited person",
  })
  person: BasePerson;
}

export class PartialMovieCastMember extends OmitType(MovieCastMember, [
  ...AUDIT_FIELDS,
  "person",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;
}

export class SparseMovieCrewMember {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The department the job belongs to",
  })
  department: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The job performed",
  })
  job: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie crew member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie crew member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class MovieCrewMember extends SparseMovieCrewMember {
  @ApiProperty({
    required: true,
    type: BasePerson,
    description: "The credited person",
  })
  person: BasePerson;
}

export class PartialMovieCrewMember extends OmitType(MovieCrewMember, [
  ...AUDIT_FIELDS,
  "person",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;
}

export class MovieReleaseDate {
  @ApiProperty({
    required: true,
    type: Country,
    description: "The country of the release",
  })
  country: Country;

  @ApiProperty({
    required: false,
    type: Language,
    description: "The language of the release",
  })
  language?: Language;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string indicating the release date",
  })
  releaseDate?: Moment;

  @ApiProperty({
    required: true,
    type: Number,
    description:
      "The TMDB release type: 1 Premiere, 2 Theatrical (limited), 3 Theatrical, 4 Digital, 5 Physical, 6 TV",
  })
  type: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "A note about the release, e.g. the festival it premiered at",
  })
  note: string;

  @ApiProperty({
    required: false,
    type: Certification,
    description: "The rating given for the release",
  })
  certification?: Certification;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie release date was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie release date was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialMovieReleaseDate extends OmitType(MovieReleaseDate, [
  ...AUDIT_FIELDS,
  "country",
  "language",
  "certification",
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

  @ApiProperty({
    required: true,
    type: String,
    description: "The ID of the certification",
  })
  certificationId: string;
}

export class MovieRecommendation {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    description: "The recommended movie",
  })
  movie: SparseMovie;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie recommendation was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the movie recommendation was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialMovieRecommendation {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the recommended movie",
  })
  recommendationId: number;
}

export class CreateMovieRequest {
  @ApiProperty({
    required: true,
    type: () => PartialMovie,
    description: "The movie to create",
  })
  movie: PartialMovie;
}

export class CreateMovieResponse {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    description: "The created movie",
  })
  movie: SparseMovie;
}

export class DescribeMovieResponse {
  @ApiProperty({
    required: true,
    type: () => Movie,
    description: "The requested movie",
  })
  movie: Movie;
}

export class ListMoviesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    isArray: true,
    description: "The movies on the requested page",
  })
  movies: SparseMovie[];
}

export class ListMovieCastResponse {
  @ApiProperty({
    required: true,
    type: () => MovieCastMember,
    isArray: true,
    description: "The movie's cast",
  })
  cast: MovieCastMember[];
}

export class ListMovieCrewResponse {
  @ApiProperty({
    required: true,
    type: () => MovieCrewMember,
    isArray: true,
    description: "The movie's crew",
  })
  crew: MovieCrewMember[];
}

export class ListMovieRecommendationsResponse {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    isArray: true,
    description: "Movies recommended based on the requested movie",
  })
  recommendations: SparseMovie[];
}

export class ListMovieCollectionsResponse {
  @ApiProperty({
    required: true,
    type: () => Collection,
    isArray: true,
    description: "The collections that include the movie",
  })
  collections: Collection[];
}

export class GetMovieLocationStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => LocationStatistic,
    isArray: true,
    description: "Movie counts by country",
  })
  statistics: LocationStatistic[];
}

export class GetMovieReleaseStatusStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => StatusStatistic,
    isArray: true,
    description: "Movie counts by release status",
  })
  statistics: StatusStatistic[];
}

export class GetMovieReleaseYearStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => YearStatistic,
    isArray: true,
    description: "Movie counts by release year",
  })
  statistics: YearStatistic[];
}

export class GetMovieRuntimeStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => RuntimeStatistic,
    isArray: true,
    description: "Movie counts by runtime",
  })
  statistics: RuntimeStatistic[];
}

export class GetMovieAggregateStatisticsResponse {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of movies",
  })
  count: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average budget in US dollars",
  })
  averageBudget: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average revenue in US dollars",
  })
  averageRevenue: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The highest revenue in US dollars",
  })
  maxRevenue: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average runtime in minutes",
  })
  averageRuntime: number;
}
