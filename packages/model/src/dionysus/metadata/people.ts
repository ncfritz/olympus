import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the person",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: Boolean,
    description: "Whether the person is flagged as adult content",
  })
  adult: boolean;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating the person's date of birth",
  })
  birthday?: Moment;

  @ApiProperty({
    required: false,
    type: String,
    description: "The place of birth",
  })
  birthplace?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating the person's date of death",
  })
  deathday?: Moment;

  @ApiProperty({
    required: true,
    enum: () => Gender,
    enumName: "Gender",
    description: "The gender recorded by TMDB",
  })
  gender: Gender;

  @ApiProperty({
    required: true,
    type: String,
    description: "The URL of the official homepage",
  })
  homepage: string;

  @ApiProperty({ required: true, type: String, description: "The IMDb ID" })
  imdbId: string;

  @ApiProperty({
    required: true,
    type: String,
    description:
      "The department the person is best known for, e.g. Acting or Directing",
  })
  knownForDepartment: string;

  @ApiProperty({
    required: false,
    type: String,
    description: "The TMDB path of the profile image",
  })
  profilePath?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB popularity score",
  })
  popularity: number;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person was last updated",
  })
  lastUpdatedTime: Moment;
}

export class Person extends BasePerson {
  @ApiProperty({ required: true, type: String, description: "The biography" })
  biography: string;

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
    description:
      "IDs of the person in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => PersonAlsoKnownAs,
    isArray: true,
    description: "Other names the person is known by",
  })
  alsoKnownAs: PersonAlsoKnownAs[];

  @ApiProperty({
    required: true,
    type: () => BaseImage,
    isArray: true,
    description: "Images of the person",
  })
  images: BaseImage[];
}

export class PartialPerson extends OmitType(BasePerson, [...AUDIT_FIELDS]) {
  @ApiProperty({ required: true, type: String, description: "The biography" })
  biography: string;

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
    description:
      "IDs of the person in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialPersonAlsoKnownAs,
    isArray: true,
    description: "Other names the person is known by",
  })
  alsoKnownAs: PartialPersonAlsoKnownAs[];

  @ApiProperty({
    required: true,
    type: () => PartialBaseImage,
    isArray: true,
    description: "Images of the person",
  })
  images: PartialBaseImage[];
}

export class PersonAlsoKnownAs {
  @ApiProperty({
    required: true,
    type: String,
    description: "The alternative name",
  })
  name: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person also known as was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person also known as was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialPersonAlsoKnownAs extends OmitType(PersonAlsoKnownAs, [
  ...AUDIT_FIELDS,
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
  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The associated person",
  })
  person: BasePerson;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the person association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PersonLifeStatistic {
  @ApiProperty({ required: true, type: Number, description: "The year" })
  year: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of people in the year",
  })
  count: number;
}

export class PersonDepartmentStatistic {
  @ApiProperty({ required: true, type: String, description: "The department" })
  department: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of people known for the department",
  })
  count: number;
}

export class PartialPersonAssociation extends OmitType(PersonAssociation, [
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

export class CreatePersonRequest {
  @ApiProperty({
    required: true,
    type: () => PartialPerson,
    description: "The person to create",
  })
  person: PartialPerson;
}

export class CreatePersonResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The TMDB ID of the created person",
  })
  id: number;
}

export class DescribePersonResponse {
  @ApiProperty({
    required: true,
    type: () => Person,
    description: "The requested person",
  })
  person: Person;
}

export class ListPeopleResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BasePerson,
    isArray: true,
    required: true,
    description: "The people on the requested page",
  })
  people: BasePerson[];
}

export class ListMovieCastRolesForPersonResponse {
  @ApiProperty({
    type: () => PersonMovieCastCredit,
    isArray: true,
    required: true,
    description: "The person's movie cast credits",
  })
  credits: PersonMovieCastCredit[];
}

export class ListMovieCrewJobsForPersonResponse {
  @ApiProperty({
    type: () => PersonMovieCrewCredit,
    isArray: true,
    required: true,
    description: "The person's movie crew credits",
  })
  credits: PersonMovieCrewCredit[];
}

export class ListTvSeriesCastRolesForPersonResponse {
  @ApiProperty({
    type: () => PersonTvSeriesCastCredit,
    isArray: true,
    required: true,
    description: "The person's TV series cast credits",
  })
  credits: PersonTvSeriesCastCredit[];
}

export class ListTvGuestAppearancesForPersonResponse {
  @ApiProperty({
    type: () => PersonTvEpisodeGuestAppearance,
    isArray: true,
    required: true,
    description: "The person's TV guest appearances",
  })
  credits: PersonTvEpisodeGuestAppearance[];
}

export class ListTvSeriesCrewJobsForPersonResponse {
  @ApiProperty({
    type: () => PersonTvSeriesCrewCredit,
    isArray: true,
    required: true,
    description: "The person's TV series crew credits",
  })
  credits: PersonTvSeriesCrewCredit[];
}

export class GetPersonLifeStaticsResponse {
  @ApiProperty({
    type: () => PersonLifeStatistic,
    isArray: true,
    required: true,
    description: "People counts by year",
  })
  statistics: PersonLifeStatistic[];
}

export class GetPersonDepartmentStaticsResponse {
  @ApiProperty({
    type: () => PersonDepartmentStatistic,
    isArray: true,
    required: true,
    description: "People counts by department",
  })
  statistics: PersonDepartmentStatistic[];
}
