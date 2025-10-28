import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
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
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String })
  backdropPath: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  firstAirDate?: Moment;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: Boolean })
  inProduction: boolean;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  lastAirDate?: Moment;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  numberOfEpisodes: number;

  @ApiProperty({ type: Number })
  numberOfSeasons: number;

  @ApiProperty({ type: String })
  originalName: string;

  @ApiProperty({ type: Number })
  popularity: number;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  posterPath?: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: String })
  tagline: string;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: Number })
  voteCount: number;

  @ApiProperty({ type: Number })
  voteAverage: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class SparseTvSeries extends BaseTVSeries {
  @ApiProperty({ type: () => Language })
  originalLanguage: Language;

  @ApiProperty({
    type: () => AlternativeTitle,
    isArray: true,
  })
  alternativeTitles: AlternativeTitle[];

  @ApiProperty({
    type: () => Certification,
    isArray: true,
  })
  certifications: CertificationAssociation[];

  @ApiProperty({
    type: () => TVSeriesRuntime,
    isArray: true,
  })
  runtimes: TVSeriesRuntime[];

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
    type: () => KeywordAssociation,
    isArray: true,
  })
  keywords: KeywordAssociation[];

  @ApiProperty({
    type: () => LanguageAssociation,
    isArray: true,
  })
  languages: LanguageAssociation[];

  @ApiProperty({
    type: () => CountryAssociation,
    isArray: true,
  })
  originCountries: CountryAssociation[];

  @ApiProperty({ type: () => LanguageAssociation, isArray: true })
  spokenLanguages: LanguageAssociation[];
}

export class TVSeries extends SparseTvSeries {
  @ApiProperty({ type: () => SparseEpisode })
  lastEpisodeToAir?: SparseEpisode;

  @ApiProperty({ type: () => SparseEpisode })
  nextEpisodeToAir?: SparseEpisode;

  @ApiProperty({ type: () => TvSeriesCreatedBy, isArray: true })
  createdBy: TvSeriesCreatedBy[];

  @ApiProperty({
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];

  @ApiProperty({
    type: () => NetworkAssociation,
    isArray: true,
  })
  networks: NetworkAssociation[];

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

  @ApiProperty({ type: () => SparseSeason, isArray: true })
  seasons: SparseSeason[];

  @ApiProperty({ type: () => Video, isArray: true })
  videos: Video[];
}

export class TVSeriesWithCastAndCrew extends TVSeries {
  @ApiProperty({
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}

export class PartialTVSeries extends OmitType(BaseTVSeries, [
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ type: () => String })
  originalLanguageCode: string;

  @ApiProperty({ type: () => Number, required: false })
  lastEpisodeToAirId?: number;

  @ApiProperty({ type: () => Number, required: false })
  nextEpisodeToAirId?: number;

  @ApiProperty({
    type: () => PartialAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialAlternativeTitle[];

  @ApiProperty({
    type: () => PartialTVSeriesCastMember,
    isArray: true,
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    type: () => PartialTVSeriesCertification,
    isArray: true,
  })
  certifications: PartialTVSeriesCertification[];

  @ApiProperty({
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    type: () => PartialTvSeriesCreatedBy,
    isArray: true,
  })
  createdBy: PartialTvSeriesCreatedBy[];

  @ApiProperty({
    type: () => PartialTVSeriesRuntime,
    isArray: true,
  })
  runtimes: PartialTVSeriesRuntime[];

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
    type: () => PartialLanguageAssociation,
    isArray: true,
  })
  languages: PartialLanguageAssociation[];

  @ApiProperty({
    type: () => PartialNetworkAssociation,
    isArray: true,
  })
  networks: PartialNetworkAssociation[];

  @ApiProperty({
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  originCountries: PartialCountryAssociation[];

  @ApiProperty({
    type: () => PartialProductionCompanyAssociation,
    isArray: true,
  })
  productionCompanies: PartialProductionCompanyAssociation[];

  @ApiProperty({
    type: () => PartialTvSeriesRecommendation,
    isArray: true,
  })
  recommendations: PartialTvSeriesRecommendation[];

  @ApiProperty({
    type: () => PartialCountryAssociation,
    isArray: true,
  })
  productionCountries: PartialCountryAssociation[];

  @ApiProperty({ type: () => PartialLanguageAssociation, isArray: true })
  spokenLanguages: PartialLanguageAssociation[];

  @ApiProperty({
    type: () => PartialVideo,
    isArray: true,
  })
  videos: PartialVideo[];
}

export class TVSeriesCastMemberRole {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: String })
  character: string;

  @ApiProperty({ type: Number })
  episodeCount: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCastMemberRole extends OmitType(
  TVSeriesCastMemberRole,
  ["createdTime", "lastUpdatedTime"],
) {}

export class SparseTVSeriesCastMember {
  @ApiProperty({ type: () => TVSeriesCastMemberRole, isArray: true })
  roles: TVSeriesCastMemberRole[];

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  originalName?: string;

  @ApiProperty({ type: Number })
  totalEpisodeCount: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVSeriesCastMember extends SparseTVSeriesCastMember {
  @ApiProperty({ type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVSeriesCastMember extends OmitType(TVSeriesCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
  "roles",
]) {
  @ApiProperty({ type: Number })
  personId: number;

  @ApiProperty({ type: () => PartialTVSeriesCastMemberRole, isArray: true })
  roles?: PartialTVSeriesCastMemberRole[];
}

export class TVSeriesCrewMemberJob {
  @ApiProperty({ type: String })
  creditId: string;

  @ApiProperty({ type: String })
  job: string;

  @ApiProperty({ type: Number })
  episodeCount: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCrewMemberJob extends OmitType(
  TVSeriesCrewMemberJob,
  ["createdTime", "lastUpdatedTime"],
) {}

export class SparseTVSeriesCrewMember {
  @ApiProperty({ type: String })
  department: string;

  @ApiProperty({ type: () => TVSeriesCrewMemberJob, isArray: true })
  jobs: TVSeriesCrewMemberJob[];

  @ApiProperty({ type: String })
  originalName?: string;

  @ApiProperty({ type: Number })
  totalEpisodeCount: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class TVSeriesCrewMember extends SparseTVSeriesCrewMember {
  @ApiProperty({ type: () => BasePerson })
  person: BasePerson;
}

export class PartialTVSeriesCrewMember extends OmitType(TVSeriesCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
  "jobs",
]) {
  @ApiProperty({ type: Number })
  personId: number;

  @ApiProperty({ type: () => PartialTVSeriesCrewMemberJob, isArray: true })
  jobs?: PartialTVSeriesCrewMemberJob[];
}

export class TVSeriesRuntime {
  @ApiProperty({ type: Number })
  runTime: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
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
  @ApiProperty({ type: () => BasePerson })
  person: BasePerson;

  @ApiProperty({ type: String, required: true })
  creditId: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesCreatedBy extends OmitType(TvSeriesCreatedBy, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class TvSeriesRecommendation {
  @ApiProperty({
    type: () => BaseTVSeries,
  })
  tvSeries: BaseTVSeries;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTvSeriesRecommendation {
  @ApiProperty({ type: Number })
  recommendationId: number;
}

export class CreateTVSeriesRequest {
  @ApiProperty({
    type: () => PartialTVSeries,
  })
  tvSeries: PartialTVSeries;
}

export class CreateTVSeriesResponse {
  @ApiProperty({
    type: () => Number,
  })
  seriesId: number;
}

export class DescribeTVSeriesResponse {
  @ApiProperty({
    type: () => TVSeries,
  })
  tvSeries: TVSeries;
}

export class ListTvSeriesCastResponse {
  @ApiProperty({
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeriesCrewResponse {
  @ApiProperty({
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];
}

export class ListTvSeriesResponse {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
  })
  tvSeries: BaseTVSeries[];
}

export class ListTvSeriesRecommendationsResponse {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
  })
  recommendations: BaseTVSeries[];
}

export class GetTvSeriesLocationStatisticsResponse {
  @ApiProperty({
    type: () => LocationStatistic,
    isArray: true,
  })
  statistics: LocationStatistic[];
}

export class GetTvSeriesStatusStatisticsResponse {
  @ApiProperty({
    type: () => StatusStatistic,
    isArray: true,
  })
  statistics: StatusStatistic[];
}

export class GetTvSeriesFirstAirYearStatisticsResponse {
  @ApiProperty({
    type: () => YearStatistic,
    isArray: true,
  })
  statistics: YearStatistic[];
}

export class GetTvSeriesEpisodeStatisticsResponse {
  @ApiProperty({
    type: () => RuntimeStatistic,
    isArray: true,
  })
  statistics: RuntimeStatistic[];
}

export class GetTvSeriesSeasonStatisticsResponse {
  @ApiProperty({
    type: () => SeasonStatistic,
    isArray: true,
  })
  statistics: SeasonStatistic[];
}

export class GetTvSeriesAggregateStatisticsResponse {
  @ApiProperty({ type: Number })
  count: number;

  @ApiProperty({ type: Number })
  totalSeasons: number;

  @ApiProperty({ type: Number })
  averageSeasonCount: number;

  @ApiProperty({ type: Number })
  maxSeasonCount: number;

  @ApiProperty({ type: Number })
  totalEpisodes: number;

  @ApiProperty({ type: Number })
  averageEpisodeCount: number;

  @ApiProperty({ type: Number })
  maxEpisodeCount: number;
}
