import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Country } from "./countries";

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

  @ApiProperty({ type: String })
  biography: string;

  @ApiProperty({ type: String })
  birthday: string;

  @ApiProperty({ type: String })
  birthplace: string;

  @ApiProperty({ type: String })
  deathday: string;

  @ApiProperty({ enum: Gender })
  gender: Gender;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String })
  imdbId: string;

  @ApiProperty({ type: String })
  knownForDepartment: string;

  @ApiProperty({ type: String })
  profilePath: string;
}

export class Person extends BasePerson {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => PersonExternalId,
    isArray: true,
  })
  externalIds: PersonExternalId[];

  @ApiProperty({
    type: () => PersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PersonAlsoKnownAs[];

  @ApiProperty({ type: () => PersonImage, isArray: true })
  images: PersonImage[];
}

export class PartialPerson extends BasePerson {
  @ApiProperty({
    type: () => PartialPersonExternalId,
    isArray: true,
  })
  externalIds: PartialPersonExternalId[];

  @ApiProperty({
    type: () => PartialPersonAlsoKnownAs,
    isArray: true,
  })
  alsoKnownAs: PartialPersonAlsoKnownAs[];

  @ApiProperty({ type: () => PartialPersonImage, isArray: true })
  images: PartialPersonImage[];
}

export class PersonExternalId {
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

export class PartialPersonExternalId extends OmitType(PersonExternalId, [
  "createdTime",
  "lastUpdatedTime",
]) {}

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

export class PersonImage {
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

export class PartialPersonImage extends OmitType(PersonImage, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class CreatePersonRequest {
  @ApiProperty({
    type: () => PartialPerson,
  })
  person: PartialPerson;
}

export class CreatePersonResponse {
  @ApiProperty({
    type: () => Person,
  })
  person: Person;
}
