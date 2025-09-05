import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
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

export enum Gender {
  UNKNOWN = 0,
  FEMALE = 1,
  MALE = 2,
  NON_BINARY = 3,
}

export class BasePerson {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Boolean })
  adult: boolean;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  birthday?: Moment;

  @ApiProperty({ type: String })
  birthplace?: string;

  @ApiProperty({ type: String, required: false })
  @Transform(({ value }) => (value ? value.toISOString() : undefined))
  deathday?: Moment;

  @ApiProperty({ enum: () => Gender, enumName: "Gender" })
  gender: Gender;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String })
  imdbId: string;

  @ApiProperty({ type: String })
  knownForDepartment: string;

  @ApiProperty({ type: String })
  profilePath?: string;

  @ApiProperty({ type: Number })
  popularity: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class Person extends BasePerson {
  @ApiProperty({ type: String })
  biography: string;

  @ApiProperty({
    type: () => ExternalId,
    isArray: true,
  })
  externalIds: ExternalId[];

  @ApiProperty({
    type: () => PersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PersonAlsoKnownAs[];

  @ApiProperty({ type: () => BaseImage, isArray: true })
  images: BaseImage[];
}

export class PartialPerson extends OmitType(BasePerson, [
  "createdTime",
  "lastUpdatedTime",
]) {
  @ApiProperty({ type: String })
  biography: string;

  @ApiProperty({
    type: () => PartialExternalId,
    isArray: true,
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    type: () => PartialPersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PartialPersonAlsoKnownAs[];

  @ApiProperty({ type: () => PartialBaseImage, isArray: true })
  images: PartialBaseImage[];
}

export class PersonAlsoKnownAs {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialPersonAlsoKnownAs extends OmitType(PersonAlsoKnownAs, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class PersonMovieCastCredit {
  @ApiProperty({
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

export class PersonAssociation {
  @ApiProperty({ type: BasePerson })
  person: BasePerson;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialPersonAssociation extends OmitType(PersonAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "person",
]) {
  @ApiProperty({ type: Number })
  personId: number;
}

export class CreatePersonRequest {
  @ApiProperty({
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
    type: () => Person,
  })
  person: Person;
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
