import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PaginatedResults } from "../../common";
import {
  BaseImage,
  ExternalId,
  PartialBaseImage,
  PartialExternalId,
} from "./common";
import {
  SparseMovie,
  SparseMovieCastMember,
  SparseMovieCrewMember,
} from "./movies";
import { SparseTVEpisodeCastMember } from "./tvEpisode";
import { SparseSeason } from "./tvSeason";
import {
  BaseTVSeries,
  SparseTVSeriesCastMember,
  SparseTVSeriesCrewMember,
} from "./tvSeries";

export enum Gender {
  UNKNOWN = 0,
  FEMALE = 1,
  MALE = 2,
  NON_BINARY = 3,
}

export class BasePerson {
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  birthday?: Moment;

  @ApiProperty({ required: false, type: String })
  birthplace?: string;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  deathday?: Moment;

  @ApiProperty({ required: true, enum: () => Gender, enumName: "Gender" })
  gender: Gender;

  @ApiProperty({ required: true, type: String })
  homepage: string;

  @ApiProperty({ required: true, type: String })
  imdbId: string;

  @ApiProperty({ required: true, type: String })
  knownForDepartment: string;

  @ApiProperty({ required: false, type: String })
  profilePath?: string;

  @ApiProperty({ required: true, type: Number })
  popularity: number;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class Person extends BasePerson {
  @ApiProperty({ required: true, type: String })
  biography: string;

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => PersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PersonAlsoKnownAs[];

  @ApiProperty({ required: true, type: () => BaseImage, isArray: true })
  images: BaseImage[];
}

export class PartialPerson extends OmitType(BasePerson, [
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ required: true, type: String })
  biography: string;

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialPersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PartialPersonAlsoKnownAs[];

  @ApiProperty({ required: true, type: () => PartialBaseImage, isArray: true })
  images: PartialBaseImage[];
}

export class PersonAlsoKnownAs {
  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialPersonAlsoKnownAs extends OmitType(PersonAlsoKnownAs, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class PersonMovieCastCredit {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    description: "The movie that the credits are associated with",
  })
  movie: SparseMovie;

  @ApiProperty({
    type: () => SparseMovieCastMember,
    description: "The set of roles played by the person",
    isArray: true,
    required: true,
  })
  roles: SparseMovieCastMember[];
}

export class PersonMovieCrewCredit {
  @ApiProperty({
    required: true,
    type: () => SparseMovie,
    description: "The movie that the credits are associated with",
  })
  movie: SparseMovie;

  @ApiProperty({
    type: () => SparseMovieCrewMember,
    description: "The set of crew jobs the person performed",
    isArray: true,
    required: true,
  })
  jobs: SparseMovieCrewMember[];
}

export class PersonTvSeriesCastCredit {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    description: "The TV series that the credits are associated with",
  })
  tvSeries: BaseTVSeries;

  @ApiProperty({
    type: () => SparseTVSeriesCastMember,
    description: "The set of roles played by the person",
    isArray: true,
    required: true,
  })
  roles: SparseTVSeriesCastMember[];
}

export class PersonTvSeriesCrewCredit {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    description: "The TV Series that the credits are associated with",
  })
  tvSeries: BaseTVSeries;

  @ApiProperty({
    type: () => SparseTVSeriesCrewMember,
    description: "The set of crew jobs the person performed",
    isArray: true,
    required: true,
  })
  jobs: SparseTVSeriesCrewMember[];
}

export class PersonTvEpisodeGuestAppearance {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    description: "The TV series that the credits are associated with",
  })
  movie: BaseTVSeries;

  @ApiProperty({
    required: true,
    type: () => SparseSeason,
    description: "The season that the credits are associated with",
  })
  season: SparseSeason;

  @ApiProperty({
    type: () => SparseTVEpisodeCastMember,
    description: "The guest appearance",
    required: true,
  })
  appearance: SparseTVEpisodeCastMember;
}

export class PersonAssociation {
  @ApiProperty({ required: true, type: () => BasePerson })
  person: BasePerson;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PersonLifeStatistic {
  @ApiProperty({ required: true, type: Number })
  year: number;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class PersonDepartmentStatistic {
  @ApiProperty({ required: true, type: String })
  department: string;

  @ApiProperty({ required: true, type: Number })
  count: number;
}

export class PartialPersonAssociation extends OmitType(PersonAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ required: true, type: Number })
  personId: number;
}

export class CreatePersonRequest {
  @ApiProperty({
    required: true,
    type: () => PartialPerson,
  })
  person: PartialPerson;
}

export class CreatePersonResponse {
  @ApiProperty({ type: Number, required: true })
  id: number;
}

export class DescribePersonResponse {
  @ApiProperty({
    required: true,
    type: () => Person,
  })
  person: Person;
}

export class ListPeopleResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BasePerson,
    isArray: true,
    required: true,
  })
  people: BasePerson[];
}

export class ListMovieCastRolesForPersonResponse {
  @ApiProperty({
    type: () => PersonMovieCastCredit,
    isArray: true,
    required: true,
  })
  credits: PersonMovieCastCredit[];
}

export class ListMovieCrewJobsForPersonResponse {
  @ApiProperty({
    type: () => PersonMovieCrewCredit,
    isArray: true,
    required: true,
  })
  credits: PersonMovieCrewCredit[];
}

export class ListTvSeriesCastRolesForPersonResponse {
  @ApiProperty({
    type: () => PersonTvSeriesCastCredit,
    isArray: true,
    required: true,
  })
  credits: PersonTvSeriesCastCredit[];
}

export class ListTvGuestAppearancesForPersonResponse {
  @ApiProperty({
    type: () => PersonTvEpisodeGuestAppearance,
    isArray: true,
    required: true,
  })
  credits: PersonTvEpisodeGuestAppearance[];
}

export class ListTvSeriesCrewJobsForPersonResponse {
  @ApiProperty({
    type: () => PersonTvSeriesCrewCredit,
    isArray: true,
    required: true,
  })
  credits: PersonTvSeriesCrewCredit[];
}

export class GetPersonLifeStaticsResponse {
  @ApiProperty({
    type: () => PersonLifeStatistic,
    isArray: true,
    required: true,
  })
  statistics: PersonLifeStatistic[];
}

export class GetPersonDepartmentStaticsResponse {
  @ApiProperty({
    type: () => PersonDepartmentStatistic,
    isArray: true,
    required: true,
  })
  statistics: PersonDepartmentStatistic[];
}
