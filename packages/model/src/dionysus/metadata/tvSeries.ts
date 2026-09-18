import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { MediaAssetSearchConfiguration, SparseMediaFavorite } from "../media";
import {
  CertificationAssociation,
  PartialCertification,
} from "./certifications";
import {
  AlternativeTitle,
  ExternalId,
  LocationStatistic,
  PartialAlternativeTitle,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  RuntimeStatistic,
  SeasonStatistic,
  StatusStatistic,
  TypedImage,
  Video,
  YearStatistic,
} from "./common";
import { CountryAssociation, PartialCountryAssociation } from "./countries";
import { GenreAssociation, PartialGenreAssociation } from "./genres";
import { KeywordAssociation, PartialKeywordAssociation } from "./keywords";
import {
  Language,
  LanguageAssociation,
  PartialLanguageAssociation,
} from "./languages";
import { NetworkAssociation, PartialNetworkAssociation } from "./networks";
import { BasePerson } from "./people";
import {
  PartialProductionCompanyAssociation,
  ProductionCompanyAssociation,
} from "./propductionCompanies";
import { SparseEpisode } from "./tvEpisode";
import { SparseSeason } from "./tvSeason";

export class BaseTVSeries {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the TV series",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: Boolean,
    description: "Whether the TV series is flagged as adult content",
  })
  adult: boolean;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB path of the backdrop image",
  })
  backdropPath: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the first episode aired",
  })
  firstAirDate?: Moment;

  @ApiProperty({
    required: true,
    type: String,
    description: "The URL of the official homepage",
  })
  homepage: string;

  @ApiProperty({
    required: true,
    type: Boolean,
    description: "Whether the series is still in production",
  })
  inProduction: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the most recent episode aired",
  })
  lastAirDate?: Moment;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the TV series",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of episodes",
  })
  numberOfEpisodes: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of seasons",
  })
  numberOfSeasons: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name in the original language",
  })
  originalName: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB popularity score",
  })
  popularity: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "A summary of the TV series",
  })
  overview: string;

  @ApiProperty({
    required: false,
    type: String,
    description: "The TMDB path of the poster image",
  })
  posterPath?: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The series status, e.g. Returning Series or Ended",
  })
  status: string;

  @ApiProperty({ required: true, type: String, description: "The tagline" })
  tagline: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The series type, e.g. Scripted or Documentary",
  })
  type: string;

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

  @ApiProperty({
    required: true,
    type: () => GenreAssociation,
    isArray: true,
    description: "The genres of the TV series",
  })
  genres: GenreAssociation[];

  @ApiProperty({
    type: () => MediaAssetSearchConfiguration,
    required: false,
    description:
      "The media search configuration for the TV series, if there is one",
  })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
    description:
      "The favorite record, if the TV series is marked as a favorite",
  })
  favorite?: SparseMediaFavorite;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series was last updated",
  })
  lastUpdatedTime: Moment;
}

export class SparseTvSeries extends BaseTVSeries {
  @ApiProperty({
    required: true,
    type: () => Language,
    description: "The original language",
  })
  originalLanguage: Language;

  @ApiProperty({
    required: true,
    type: () => AlternativeTitle,
    isArray: true,
    description: "Alternative titles, such as working or regional titles",
  })
  alternativeTitles: AlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => CertificationAssociation,
    isArray: true,
    description: "Content ratings by country",
  })
  certifications: CertificationAssociation[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesRuntime,
    isArray: true,
    description: "Typical episode runtimes",
  })
  runtimes: TVSeriesRuntime[];

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
    description:
      "IDs of the TV series in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => KeywordAssociation,
    isArray: true,
    description: "The keywords associated with the TV series",
  })
  keywords: KeywordAssociation[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
    description: "The languages of the TV series",
  })
  languages: LanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => CountryAssociation,
    isArray: true,
    description: "The countries the TV series originated in",
  })
  originCountries: CountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
    description: "The languages spoken in the TV series",
  })
  spokenLanguages: LanguageAssociation[];
}

export class TVSeries extends SparseTvSeries {
  @ApiProperty({
    required: false,
    type: () => SparseEpisode,
    description: "The most recently aired episode",
  })
  lastEpisodeToAir?: SparseEpisode;

  @ApiProperty({
    required: false,
    type: () => SparseEpisode,
    description: "The next episode scheduled to air, if known",
  })
  nextEpisodeToAir?: SparseEpisode;

  @ApiProperty({
    required: true,
    type: () => TvSeriesCreatedBy,
    isArray: true,
    description: "The people credited as creators of the TV series",
  })
  createdBy: TvSeriesCreatedBy[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
    description: "Images of the TV series",
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => NetworkAssociation,
    isArray: true,
    description: "The networks that aired the TV series",
  })
  networks: NetworkAssociation[];

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
    description: "The countries the TV series was produced in",
  })
  productionCountries: CountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => SparseSeason,
    isArray: true,
    description: "The seasons of the TV series",
  })
  seasons: SparseSeason[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: Video[];
}

export class TVSeriesWithCastAndCrew extends TVSeries {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: TVSeriesCrewMember[];
}

export class PartialTVSeries extends OmitType(BaseTVSeries, [
  "genres",
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({
    required: true,
    type: () => String,
    description: "The ISO 639-1 code of the original language",
  })
  originalLanguageCode: string;

  @ApiProperty({
    type: () => Number,
    required: false,
    description: "The TMDB ID of the most recently aired episode",
  })
  lastEpisodeToAirId?: number;

  @ApiProperty({
    type: () => Number,
    required: false,
    description: "The TMDB ID of the next episode scheduled to air",
  })
  nextEpisodeToAirId?: number;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeTitle,
    isArray: true,
    description: "Alternative titles, such as working or regional titles",
  })
  alternativeTitles: PartialAlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCertification,
    isArray: true,
    description: "Content ratings by country",
  })
  certifications: PartialTVSeriesCertification[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTvSeriesCreatedBy,
    isArray: true,
    description: "The people credited as creators of the TV series",
  })
  createdBy: PartialTvSeriesCreatedBy[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesRuntime,
    isArray: true,
    description: "Typical episode runtimes",
  })
  runtimes: PartialTVSeriesRuntime[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
    description:
      "IDs of the TV series in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialGenreAssociation,
    isArray: true,
    description: "The genres of the TV series",
  })
  genres: PartialGenreAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
    description: "Images of the TV series",
  })
  images: PartialTypedImage[];

  @ApiProperty({
    required: true,
    type: () => PartialKeywordAssociation,
    isArray: true,
    description: "The keywords associated with the TV series",
  })
  keywords: PartialKeywordAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialLanguageAssociation,
    isArray: true,
    description: "The languages of the TV series",
  })
  languages: PartialLanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialNetworkAssociation,
    isArray: true,
    description: "The networks that aired the TV series",
  })
  networks: PartialNetworkAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
    description: "The countries the TV series originated in",
  })
  originCountries: PartialCountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
    description: "The production companies",
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialTvSeriesRecommendation,
    isArray: true,
    description: "Recommended similar titles",
  })
  recommendations: PartialTvSeriesRecommendation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
    description: "The countries the TV series was produced in",
  })
  productionCountries: PartialCountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialLanguageAssociation,
    isArray: true,
    description: "The languages spoken in the TV series",
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

export class TVSeriesCastMemberRole {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the character played",
  })
  character: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of episodes the credit applies to",
  })
  episodeCount: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series cast member role was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series cast member role was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCastMemberRole extends OmitType(
  TVSeriesCastMemberRole,
  [...AUDIT_FIELDS],
) {}

export class SparseTVSeriesCastMember {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMemberRole,
    isArray: true,
    description: "The characters played, with episode counts",
  })
  roles: TVSeriesCastMemberRole[];

  @ApiProperty({
    required: true,
    type: Number,
    description: "The billing order in the credits",
  })
  order: number;

  @ApiProperty({
    required: false,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of episodes the person is credited on",
  })
  totalEpisodeCount: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series cast member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series cast member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class TVSeriesCastMember extends SparseTVSeriesCastMember {
  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The credited person",
  })
  person: BasePerson;
}

export class PartialTVSeriesCastMember extends OmitType(TVSeriesCastMember, [
  ...AUDIT_FIELDS,
  "person",
  "roles",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;

  @ApiProperty({
    required: false,
    type: () => PartialTVSeriesCastMemberRole,
    isArray: true,
    description: "The characters played, with episode counts",
  })
  roles?: PartialTVSeriesCastMemberRole[];
}

export class TVSeriesCrewMemberJob {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The job performed",
  })
  job: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of episodes the credit applies to",
  })
  episodeCount: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series crew member job was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series crew member job was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCrewMemberJob extends OmitType(
  TVSeriesCrewMemberJob,
  [...AUDIT_FIELDS],
) {}

export class SparseTVSeriesCrewMember {
  @ApiProperty({
    required: true,
    type: String,
    description: "The department the job belongs to",
  })
  department: string;

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMemberJob,
    isArray: true,
    description: "The jobs performed, with episode counts",
  })
  jobs: TVSeriesCrewMemberJob[];

  @ApiProperty({
    required: false,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of episodes the person is credited on",
  })
  totalEpisodeCount: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series crew member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series crew member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class TVSeriesCrewMember extends SparseTVSeriesCrewMember {
  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The credited person",
  })
  person: BasePerson;
}

export class PartialTVSeriesCrewMember extends OmitType(TVSeriesCrewMember, [
  ...AUDIT_FIELDS,
  "person",
  "jobs",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;

  @ApiProperty({
    required: false,
    type: () => PartialTVSeriesCrewMemberJob,
    isArray: true,
    description: "The jobs performed, with episode counts",
  })
  jobs?: PartialTVSeriesCrewMemberJob[];
}

export class TVSeriesRuntime {
  @ApiProperty({
    required: true,
    type: Number,
    description: "A typical episode runtime in minutes",
  })
  runTime: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series runtime was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series runtime was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesRuntime extends OmitType(TVSeriesRuntime, [
  ...AUDIT_FIELDS,
]) {}

export class PartialTVSeriesCertification extends OmitType(
  PartialCertification,
  ["meaning", "order", "certification"],
) {
  @ApiProperty({
    type: String,
    required: true,
    description: "The rating, e.g. TV-MA",
  })
  rating: string;
}

export class TvSeriesCreatedBy {
  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The credited person",
  })
  person: BasePerson;

  @ApiProperty({
    type: String,
    required: true,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series created by was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series created by was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesCreatedBy extends OmitType(TvSeriesCreatedBy, [
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

export class TvSeriesRecommendation {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    description: "The recommended TV series",
  })
  tvSeries: BaseTVSeries;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series recommendation was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV series recommendation was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesRecommendation {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the recommended TV series",
  })
  recommendationId: number;
}

export class CreateTVSeriesRequest {
  @ApiProperty({
    required: true,
    type: () => PartialTVSeries,
    description: "The TV series to create",
  })
  tvSeries: PartialTVSeries;
}

export class CreateTVSeriesResponse {
  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the TV series",
  })
  seriesId: number;
}

export class DescribeTVSeriesResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeries,
    description: "The requested TV series",
  })
  tvSeries: TVSeries;
}

export class ListTvSeriesCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
    description: "The series' cast",
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeriesCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
    description: "The series' crew",
  })
  crew: TVSeriesCrewMember[];
}

export class ListTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    isArray: true,
    description: "The TV series on the requested page",
  })
  tvSeries: BaseTVSeries[];
}

export class ListTvSeriesRecommendationsResponse {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    isArray: true,
    description: "TV series recommended based on the requested series",
  })
  recommendations: BaseTVSeries[];
}

export class GetTvSeriesLocationStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => LocationStatistic,
    isArray: true,
    description: "TV series counts by country",
  })
  statistics: LocationStatistic[];
}

export class GetTvSeriesStatusStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => StatusStatistic,
    isArray: true,
    description: "TV series counts by status",
  })
  statistics: StatusStatistic[];
}

export class GetTvSeriesFirstAirYearStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => YearStatistic,
    isArray: true,
    description: "TV series counts by first air year",
  })
  statistics: YearStatistic[];
}

export class GetTvSeriesEpisodeStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => RuntimeStatistic,
    isArray: true,
    description: "TV series counts by episode runtime",
  })
  statistics: RuntimeStatistic[];
}

export class GetTvSeriesSeasonStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => SeasonStatistic,
    isArray: true,
    description: "TV series counts by number of seasons",
  })
  statistics: SeasonStatistic[];
}

export class GetTvSeriesAggregateStatisticsResponse {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of TV series",
  })
  count: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of seasons",
  })
  totalSeasons: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average number of seasons per series",
  })
  averageSeasonCount: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The most seasons of any series",
  })
  maxSeasonCount: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of episodes",
  })
  totalEpisodes: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average number of episodes per series",
  })
  averageEpisodeCount: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The most episodes of any series",
  })
  maxEpisodeCount: number;
}
