import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Certification, PartialCertification } from "./certifications";
import { Country } from "./countries";
import { Genre } from "./genres";
import { Keyword } from "./keywords";
import { Language } from "./languages";
import { Network } from "./networks";
import { Person } from "./people";
import { ProductionCompany } from "./propductionCompanies";
import { Episode, PartialEpisode } from "./tvEpisode";
import { PartialSeason, Season } from "./tvSeason";

export class BaseTVSeries {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String })
  backdropPath: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  firstAirDate: Moment;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: Boolean })
  inProduction: boolean;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastAirDate: Moment;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  numberOfEpisodes: number;

  @ApiProperty({ type: Number })
  numberOfSeasons: number;

  @ApiProperty({ type: Language })
  originalLanguage: Language;

  @ApiProperty({ type: String })
  originalName: string;

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
}

export class TVSeries extends BaseTVSeries {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: Episode })
  lastEpisodeToAir: Episode;

  @ApiProperty({
    type: () => TVSeriesAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: TVSeriesAlternativeTitle[];

  @ApiProperty({
    type: () => TVSeriesCastMember,
    isArray: true,
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    type: () => Certification,
    isArray: true,
  })
  certifications: Certification[];

  @ApiProperty({
    type: () => TVSeriesCrewMember,
    isArray: true,
  })
  crew: TVSeriesCrewMember[];

  @ApiProperty({
    type: () => TVSeriesRuntime,
    isArray: true,
  })
  runtimes: TVSeriesRuntime[];

  @ApiProperty({ type: Episode, isArray: true })
  episodes: Episode[];

  @ApiProperty({
    type: () => TVSeriesGenre,
    isArray: true,
  })
  genres: TVSeriesGenre[];

  @ApiProperty({
    type: () => TVSeriesImage,
    isArray: true,
  })
  images: TVSeriesImage[];

  @ApiProperty({
    type: () => TVSeriesKeyword,
    isArray: true,
  })
  keywords: TVSeriesKeyword[];

  @ApiProperty({
    type: () => TVSeriesLanguage,
    isArray: true,
  })
  languages: TVSeriesLanguage[];

  @ApiProperty({
    type: () => TVSeriesNetwork,
    isArray: true,
  })
  networks: TVSeriesNetwork[];

  @ApiProperty({
    type: () => TVSeriesCountry,
    isArray: true,
  })
  originCountry: TVSeriesCountry[];

  @ApiProperty({
    type: () => TVSeriesProductionCompany,
    isArray: true,
  })
  productionCompanies: TVSeriesProductionCompany[];

  @ApiProperty({
    type: () => TVSeriesCountry,
    isArray: true,
  })
  productionCountries: TVSeriesCountry[];

  @ApiProperty({ type: Season, isArray: true })
  seasons: Season[];

  @ApiProperty({ type: () => TVSeriesSpokenLanguage, isArray: true })
  spokenLanguages: TVSeriesSpokenLanguage[];

  @ApiProperty({ type: () => TVSeriesVideo, isArray: true })
  videos: TVSeriesVideo[];
}

export class PartialTVSeries extends BaseTVSeries {
  @ApiProperty({ type: () => String })
  originalLanguageCode: string;

  @ApiProperty({
    type: () => PartialTVSeriesAlternativeTitle,
    isArray: true,
  })
  alternativeTitles: PartialTVSeriesAlternativeTitle[];

  @ApiProperty({
    type: () => PartialTVSeriesCastMember,
    isArray: true,
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    type: () => PartialCertification,
    isArray: true,
  })
  certifications: PartialCertification[];

  @ApiProperty({
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    type: () => PartialTVSeriesRuntime,
    isArray: true,
  })
  runtimes: PartialTVSeriesRuntime[];

  @ApiProperty({
    type: () => PartialEpisode,
    isArray: true,
  })
  episodes: PartialEpisode[];

  @ApiProperty({
    type: () => PartialTVSeriesGenre,
    isArray: true,
  })
  genres: PartialTVSeriesGenre[];

  @ApiProperty({
    type: () => PartialTVSeriesImage,
    isArray: true,
  })
  images: PartialTVSeriesImage[];

  @ApiProperty({
    type: () => PartialTVSeriesKeyword,
    isArray: true,
  })
  keywords: PartialTVSeriesKeyword[];

  @ApiProperty({
    type: () => PartialTVSeriesLanguage,
    isArray: true,
  })
  languages: PartialTVSeriesLanguage[];

  @ApiProperty({
    type: () => PartialTVSeriesNetwork,
    isArray: true,
  })
  networks: PartialTVSeriesNetwork[];

  @ApiProperty({
    type: () => PartialTVSeriesCountry,
    isArray: true,
  })
  originCountries: PartialTVSeriesCountry[];

  @ApiProperty({
    type: () => PartialTVSeriesProductionCompany,
    isArray: true,
  })
  productionCompanies: PartialTVSeriesProductionCompany[];

  @ApiProperty({
    type: () => PartialTVSeriesCountry,
    isArray: true,
  })
  productionCountries: PartialTVSeriesCountry[];

  @ApiProperty({
    type: () => PartialSeason,
    isArray: true,
  })
  seasons: PartialSeason[];

  @ApiProperty({ type: () => PartialTVSeriesSpokenLanguage, isArray: true })
  spokenLanguages: PartialTVSeriesSpokenLanguage[];

  @ApiProperty({
    type: () => PartialTVSeriesVideo,
    isArray: true,
  })
  videos: PartialTVSeriesVideo[];
}

export class TVSeriesAlternativeTitle {
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

export class PartialTVSeriesAlternativeTitle extends OmitType(
  TVSeriesAlternativeTitle,
  ["createdTime", "lastUpdatedTime", "country"]
) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class TVSeriesCastMember {
  @ApiProperty({ type: String })
  castId: number;

  @ApiProperty({ type: Person })
  person: Person;

  @ApiProperty({ type: String })
  originalName: string;

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

export class PartialTVSeriesCastMember extends OmitType(TVSeriesCastMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class TVSeriesCrewMember {
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

export class PartialTVSeriesCrewMember extends OmitType(TVSeriesCrewMember, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class TVSeriesRuntime {
  @ApiProperty({ type: String })
  runtime: number;

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

export class TVSeriesGenre {
  @ApiProperty({ type: Genre })
  genre: Genre;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesGenre extends OmitType(TVSeriesGenre, [
  "createdTime",
  "lastUpdatedTime",
  "genre",
]) {
  @ApiProperty({ type: Number })
  genreId: number;
}

export class TVSeriesImage {
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

export class PartialTVSeriesImage extends OmitType(TVSeriesImage, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class TVSeriesKeyword {
  @ApiProperty({ type: Keyword })
  keyword: Keyword;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesKeyword extends OmitType(TVSeriesKeyword, [
  "createdTime",
  "lastUpdatedTime",
  "keyword",
]) {
  @ApiProperty({ type: Number })
  keywordId: number;
}

export class TVSeriesLanguage {
  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesLanguage extends OmitType(TVSeriesLanguage, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ type: String })
  languageId: string;
}

export class TVSeriesNetwork {
  @ApiProperty({ type: Network })
  network: Network;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesNetwork extends OmitType(TVSeriesNetwork, [
  "createdTime",
  "lastUpdatedTime",
  "network",
]) {
  @ApiProperty({ type: Number })
  networkId: number;
}

export class TVSeriesCountry {
  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesCountry extends OmitType(TVSeriesCountry, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryId: string;
}

export class TVSeriesProductionCompany {
  @ApiProperty({ type: Country })
  productionCompany: ProductionCompany;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesProductionCompany extends OmitType(
  TVSeriesProductionCompany,
  ["createdTime", "lastUpdatedTime", "productionCompany"]
) {
  @ApiProperty({ type: Number })
  productionCompanyId: number;
}

export class TVSeriesSpokenLanguage {
  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesSpokenLanguage extends OmitType(
  TVSeriesSpokenLanguage,
  ["createdTime", "lastUpdatedTime", "language"]
) {
  @ApiProperty({ type: String })
  languageId: string;
}

export class TVSeriesVideo {
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

  @Transform(({ value }) => value.toISOString())
  publishedTime: Moment;

  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialTVSeriesVideo extends OmitType(TVSeriesVideo, [
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
