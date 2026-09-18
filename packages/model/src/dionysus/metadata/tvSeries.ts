import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetSearchConfiguration, SparseMediaFavorite } from "../media";
import {
  Certification,
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
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: Boolean })
  adult: boolean;

  @ApiProperty({ required: true, type: String })
  backdropPath: string;

  @ApiProperty({ required: false, type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  firstAirDate?: Moment;

  @ApiProperty({ required: true, type: String })
  homepage: string;

  @ApiProperty({ required: true, type: Boolean })
  inProduction: boolean;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  lastAirDate?: Moment;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: Number })
  numberOfEpisodes: number;

  @ApiProperty({ required: true, type: Number })
  numberOfSeasons: number;

  @ApiProperty({ required: true, type: String })
  originalName: string;

  @ApiProperty({ required: true, type: Number })
  popularity: number;

  @ApiProperty({ required: true, type: String })
  overview: string;

  @ApiProperty({ required: false, type: String })
  posterPath?: string;

  @ApiProperty({ required: true, type: String })
  status: string;

  @ApiProperty({ required: true, type: String })
  tagline: string;

  @ApiProperty({ required: true, type: String })
  type: string;

  @ApiProperty({ required: true, type: Number })
  voteCount: number;

  @ApiProperty({ required: true, type: Number })
  voteAverage: number;

  @ApiProperty({
    required: true,
    type: () => GenreAssociation,
    isArray: true,
  })
  genres: GenreAssociation[];

  @ApiProperty({ type: () => MediaAssetSearchConfiguration, required: false })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
  })
  favorite?: SparseMediaFavorite;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class SparseTvSeries extends BaseTVSeries {
  @ApiProperty({ required: true, type: () => Language })
  originalLanguage: Language;

  @ApiProperty({
    required: true,
    type: () => AlternativeTitle,
    isArray: true,
  })
  alternativeTitles: AlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => Certification,
    isArray: true,
  })
  certifications: CertificationAssociation[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesRuntime,
    isArray: true,
  })
  runtimes: TVSeriesRuntime[];

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => KeywordAssociation,
    isArray: true,
  })
  keywords: KeywordAssociation[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
  })
  languages: LanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => CountryAssociation,
    isArray: true,
  })
  originCountries: CountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => LanguageAssociation,
    isArray: true,
  })
  spokenLanguages: LanguageAssociation[];
}

export class TVSeries extends SparseTvSeries {
  @ApiProperty({ required: false, type: () => SparseEpisode })
  lastEpisodeToAir?: SparseEpisode;

  @ApiProperty({ required: false, type: () => SparseEpisode })
  nextEpisodeToAir?: SparseEpisode;

  @ApiProperty({ required: true, type: () => TvSeriesCreatedBy, isArray: true })
  createdBy: TvSeriesCreatedBy[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => NetworkAssociation,
    isArray: true,
  })
  networks: NetworkAssociation[];

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

  @ApiProperty({ required: true, type: () => SparseSeason, isArray: true })
  seasons: SparseSeason[];

  @ApiProperty({ required: true, type: () => Video, isArray: true })
  videos: Video[];
}

export class TVSeriesWithCastAndCrew extends TVSeries {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}

export class PartialTVSeries extends OmitType(BaseTVSeries, [
  "genres",
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ required: true, type: () => String })
  originalLanguageCode: string;

  @ApiProperty({ type: () => Number, required: false })
  lastEpisodeToAirId?: number;

  @ApiProperty({ type: () => Number, required: false })
  nextEpisodeToAirId?: number;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialAlternativeTitle[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCastMember,
    isArray: true,
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCertification,
    isArray: true,
  })
  certifications: PartialTVSeriesCertification[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTvSeriesCreatedBy,
    isArray: true,
  })
  createdBy: PartialTvSeriesCreatedBy[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesRuntime,
    isArray: true,
  })
  runtimes: PartialTVSeriesRuntime[];

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
    type: () => PartialLanguageAssociation,
    isArray: true,
  })
  languages: PartialLanguageAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialNetworkAssociation,
    isArray: true,
  })
  networks: PartialNetworkAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  originCountries: PartialCountryAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    required: true,
    type: () => PartialTvSeriesRecommendation,
    isArray: true,
  })
  recommendations: PartialTvSeriesRecommendation[];

  @ApiProperty({
    required: true,
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  productionCountries: PartialCountryAssociation[];

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

export class TVSeriesCastMemberRole {
  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: String })
  character: string;

  @ApiProperty({ required: true, type: Number })
  episodeCount: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCastMemberRole extends OmitType(
  TVSeriesCastMemberRole,
  ["createdTime", "lastUpdatedTime"],
) {}

export class SparseTVSeriesCastMember {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMemberRole,
    isArray: true,
  })
  roles: TVSeriesCastMemberRole[];

  @ApiProperty({ required: true, type: Number })
  order: number;

  @ApiProperty({ required: false, type: String })
  originalName?: string;

  @ApiProperty({ required: true, type: Number })
  totalEpisodeCount: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVSeriesCastMember extends SparseTVSeriesCastMember {
  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVSeriesCastMember extends OmitType(TVSeriesCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
  "roles",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;

  @ApiProperty({
    required: false,
    type: () => PartialTVSeriesCastMemberRole,
    isArray: true,
  })
  roles?: PartialTVSeriesCastMemberRole[];
}

export class TVSeriesCrewMemberJob {
  @ApiProperty({ required: true, type: String })
  creditId: string;

  @ApiProperty({ required: true, type: String })
  job: string;

  @ApiProperty({ required: true, type: Number })
  episodeCount: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCrewMemberJob extends OmitType(
  TVSeriesCrewMemberJob,
  ["createdTime", "lastUpdatedTime"],
) {}

export class SparseTVSeriesCrewMember {
  @ApiProperty({ required: true, type: String })
  department: string;

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMemberJob,
    isArray: true,
  })
  jobs: TVSeriesCrewMemberJob[];

  @ApiProperty({ required: false, type: String })
  originalName?: string;

  @ApiProperty({ required: true, type: Number })
  totalEpisodeCount: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVSeriesCrewMember extends SparseTVSeriesCrewMember {
  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVSeriesCrewMember extends OmitType(TVSeriesCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
  "jobs",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;

  @ApiProperty({
    required: false,
    type: () => PartialTVSeriesCrewMemberJob,
    isArray: true,
  })
  jobs?: PartialTVSeriesCrewMemberJob[];
}

export class TVSeriesRuntime {
  @ApiProperty({ required: true, type: Number })
  runTime: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesRuntime extends OmitType(TVSeriesRuntime, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class PartialTVSeriesCertification extends OmitType(
  PartialCertification,
  ["meaning", "order", "certification"],
) {
  @ApiProperty({ type: String, required: true })
  rating: string;
}

export class TvSeriesCreatedBy {
  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;

  @ApiProperty({ type: String, required: true })
  creditId: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesCreatedBy extends OmitType(TvSeriesCreatedBy, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class TvSeriesRecommendation {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
  })
  tvSeries: BaseTVSeries;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesRecommendation {
  @ApiProperty({ required: true, type: Number })
  recommendationId: number;
}

export class CreateTVSeriesRequest {
  @ApiProperty({
    required: true,
    type: () => PartialTVSeries,
  })
  tvSeries: PartialTVSeries;
}

export class CreateTVSeriesResponse {
  @ApiProperty({
    required: true,
    type: () => Number,
  })
  seriesId: number;
}

export class DescribeTVSeriesResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeries,
  })
  tvSeries: TVSeries;
}

export class ListTvSeriesCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeriesCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}

export class ListTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    isArray: true,
  })
  tvSeries: BaseTVSeries[];
}

export class ListTvSeriesRecommendationsResponse {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    isArray: true,
  })
  recommendations: BaseTVSeries[];
}

export class GetTvSeriesLocationStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => LocationStatistic,
    isArray: true,
  })
  statistics: LocationStatistic[];
}

export class GetTvSeriesStatusStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => StatusStatistic,
    isArray: true,
  })
  statistics: StatusStatistic[];
}

export class GetTvSeriesFirstAirYearStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => YearStatistic,
    isArray: true,
  })
  statistics: YearStatistic[];
}

export class GetTvSeriesEpisodeStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => RuntimeStatistic,
    isArray: true,
  })
  statistics: RuntimeStatistic[];
}

export class GetTvSeriesSeasonStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => SeasonStatistic,
    isArray: true,
  })
  statistics: SeasonStatistic[];
}

export class GetTvSeriesAggregateStatisticsResponse {
  @ApiProperty({ required: true, type: Number })
  count: number;

  @ApiProperty({ required: true, type: Number })
  totalSeasons: number;

  @ApiProperty({ required: true, type: Number })
  averageSeasonCount: number;

  @ApiProperty({ required: true, type: Number })
  maxSeasonCount: number;

  @ApiProperty({ required: true, type: Number })
  totalEpisodes: number;

  @ApiProperty({ required: true, type: Number })
  averageEpisodeCount: number;

  @ApiProperty({ required: true, type: Number })
  maxEpisodeCount: number;
}
