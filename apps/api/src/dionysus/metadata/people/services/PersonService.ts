import {
  BasePerson,
  PartialBaseImage,
  PartialExternalId,
  PartialPerson,
  PartialPersonAlsoKnownAs,
  Person,
  PersonDepartmentStatistic,
  PersonLifeStatistic,
  PersonMovieCastCredit,
  PersonMovieCrewCredit,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { MOVIE_SUMMARY_WITH_SEARCH_CONFIGURATION } from "../../movies/queries/movies";
import { YEAR_STATISTIC } from "../../queries/common";
import { BASE_PERSON } from "../queries/people";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toBaseMovieCastDomainObject } from "../../converters/CastConverter";
import { toBaseMovieCrewDomainObject } from "../../converters/CrewConverter";
import { toSparseDomainObject } from "../../movies/converters/MovieConverter";
import {
  GraphQlPersonMovieCastCredit,
  GraphQlPersonMovieCrewCredit,
} from "../../types/metadata";
import {
  toBaseDomainObject,
  toDomainObject,
} from "../converters/PersonConverter";
import { GraphQlBasePerson, GraphQlPerson } from "../types/person";

type GraphQlCreatePersonResponse = {
  insert_dionysus_people_one: { id: number };
};

type GraphQlGetPersonResponse = {
  dionysus_people_by_pk: GraphQlPerson;
};

export type GraphQlListPeopleResponse = {
  dionysus_people: GraphQlBasePerson[];
  dionysus_people_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQGetPeopleBirthdayStatisticsResponse = {
  dionysus_people_birthday_statistics: {
    year: number;
    count: number;
  }[];
};

type GraphQGetPeopleDeathdayStatisticsResponse = {
  dionysus_people_deathday_statistics: {
    year: number;
    count: number;
  }[];
};

type GraphQGetPeopleDepartmentStatisticsResponse = {
  dionysus_people_known_for: {
    department: string;
    count: number;
  }[];
};

type GraphQlListPersonCastCreditsResponse = {
  dionysus_movie_cast: GraphQlPersonMovieCastCredit[];
};

type GraphQlListPersonCrewCreditsResponse = {
  dionysus_movie_crew: GraphQlPersonMovieCrewCredit[];
};

/** People (cast and crew) in Hasura, their credits and statistics. */
@Injectable()
export class PersonService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a person; returns their ID. */
  async create(person: PartialPerson): Promise<number> {
    const insertRequest = gql`
      mutation CreatePerson(
        $id: numeric!
        $name: String!
        $adult: Boolean!
        $biography: String
        $birthday: String
        $birthplace: String
        $deathday: String
        $gender: numeric
        $homepage: String
        $imdbId: String
        $knownForDepartment: String
        $profilePath: String
        $popularity: numeric
        $externalIds: [dionysus_person_external_ids_insert_input!]!
        $alsoKnownAs: [dionysus_person_aka_insert_input!]!
        $images: [dionysus_person_images_insert_input!]!
      ) {
        insert_dionysus_people_one(
          object: {
            id: $id
            name: $name
            adult: $adult
            biography: $biography
            birthday: $birthday
            birthplace: $birthplace
            deathday: $deathday
            gender: $gender
            homepage: $homepage
            imdbId: $imdbId
            knownForDepartment: $knownForDepartment
            profilePath: $profilePath
            popularity: $popularity
            externalIds: {
              on_conflict: {
                constraint: person_external_ids_pkey
                update_columns: [type, externalId]
              }
              data: $externalIds
            }
            alsoKnownAs: {
              on_conflict: {
                constraint: person_aka_pkey
                update_columns: [name]
              }
              data: $alsoKnownAs
            }
            images: {
              on_conflict: {
                constraint: person_images_pkey
                update_columns: [filePath, width, height, languageCode]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: people_pkey
            update_columns: [
              name
              adult
              biography
              birthday
              birthplace
              deathday
              gender
              homepage
              imdbId
              knownForDepartment
              profilePath
              popularity
            ]
          }
        ) {
          id
        }
      }
    `;

    const externalIds: PartialExternalId[] = [];

    person.externalIds.forEach((value) => {
      externalIds.push({
        type: value.type,
        externalId: value.externalId,
      });
    });

    const alsoKnownAs: PartialPersonAlsoKnownAs[] = [];

    person.alsoKnownAs.forEach((value) => {
      alsoKnownAs.push({
        name: value.name,
      });
    });

    const images: PartialBaseImage[] = [];

    person.images.forEach((value) => {
      images.push({
        filePath: value.filePath,
        languageCode: value.languageCode,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreatePersonResponse>(
        insertRequest,
        {
          id: person.id,
          name: person.name,
          adult: person.adult,
          biography: person.biography,
          birthday: person.birthday,
          birthplace: person.birthplace,
          deathday: person.deathday,
          gender: person.gender,
          homepage: person.homepage,
          imdbId: person.imdbId,
          knownForDepartment: person.knownForDepartment,
          profilePath: person.profilePath,
          popularity: person.popularity,
          externalIds: externalIds,
          alsoKnownAs: alsoKnownAs,
          images: images,
        },
      );

    return insertResponse.insert_dionysus_people_one.id;
  }

  /** @throws NotFoundException */
  async describe(personId: number): Promise<Person> {
    const fetchRequest = gql`
      query DescribePerson($id: numeric!) {
        dionysus_people_by_pk(id: $id) {
          adult
          alsoKnownAs {
            createdTime
            id
            lastUpdatedTime
            name
          }
          biography
          birthday
          birthplace
          createdTime
          deathday
          popularity
          externalIds {
            createdTime
            externalId
            id
            lastUpdatedTime
            type
          }
          gender
          homepage
          id
          images {
            language {
              createdTime
              id
              lastUpdatedTime
              name
            }
            createdTime
            filePath
            height
            id
            lastUpdatedTime
            width
          }
          imdbId
          knownForDepartment
          lastUpdatedTime
          name
          profilePath
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetPersonResponse>(fetchRequest, {
        id: personId,
      });

    if (!fetchResponse.dionysus_people_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_people_by_pk);
  }

  /** A page of people and the total count matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: string,
  ): Promise<{ people: BasePerson[]; count: number }> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListPeople {
        dionysus_people(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_PERSON}
        }
        dionysus_people_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListPeopleResponse>(fetchRequest);

    return {
      people: fetchResponse.dionysus_people.map((result) =>
        toBaseDomainObject(result),
      ),
      count: fetchResponse.dionysus_people_aggregate.aggregate.count,
    };
  }

  /** The number of people born each year, by year. */
  async getBirthdayStatistics(): Promise<PersonLifeStatistic[]> {
    const fetchRequest = gql`
      query GetPeopleBirthdayStatistics {
        dionysus_people_birthday_statistics(order_by: { year: asc }) {
          ${YEAR_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleBirthdayStatisticsResponse>(
        fetchRequest,
      );
    const birthyearStats: PersonLifeStatistic[] = [];

    fetchResponse.dionysus_people_birthday_statistics.forEach((result) => {
      birthyearStats.push(result);
    });

    return birthyearStats;
  }

  /** The number of people who died each year, by year. */
  async getDeathdayStatistics(): Promise<PersonLifeStatistic[]> {
    const fetchRequest = gql`
      query GetPeopleDeathdayStatistics {
        dionysus_people_deathday_statistics(order_by: { year: asc }) {
          ${YEAR_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleDeathdayStatisticsResponse>(
        fetchRequest,
      );
    const deathyearStats: PersonLifeStatistic[] = [];

    fetchResponse.dionysus_people_deathday_statistics.forEach((result) => {
      deathyearStats.push(result);
    });

    return deathyearStats;
  }

  /**
   * The number of people known for each department: Acting first, Unknown
   * (no department) last.
   */
  async getDepartmentStatistics(): Promise<PersonDepartmentStatistic[]> {
    const fetchRequest = gql`
      query GetPeopleDepartmentStatistics {
        dionysus_people_known_for(order_by: { department: asc }) {
          count
          department
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQGetPeopleDepartmentStatisticsResponse>(
        fetchRequest,
      );
    const departmentStats: PersonDepartmentStatistic[] = [];
    let unknownCount = 0;
    let actingCount = 0;

    fetchResponse.dionysus_people_known_for.forEach((result) => {
      const key = result.department;

      if (key === null || result.department === "") {
        unknownCount += result.count;
        return;
      }

      if (key === "Acting" || result.department === "Actors") {
        actingCount += result.count;
        return;
      }

      departmentStats.push({
        department: key,
        count: result.count,
      });
    });

    departmentStats.push({
      department: "Unknown",
      count: unknownCount,
    });

    departmentStats.unshift({
      department: "Acting",
      count: actingCount,
    });

    return departmentStats;
  }

  /** A person's movie cast credits, one per movie, newest release first. */
  async listMovieCastRoles(personId: number): Promise<PersonMovieCastCredit[]> {
    const fetchRequest = gql`
      query ListMovieCastRolesForPerson($id: numeric!) {
        dionysus_movie_cast(
          where: { personId: { _eq: $id } }
          order_by: { movie: { releaseDate: desc } }
        ) {
          castId
          character
          createdTime
          creditId
          lastUpdatedTime
          movie {
            ${MOVIE_SUMMARY_WITH_SEARCH_CONFIGURATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListPersonCastCreditsResponse>(
        fetchRequest,
        { id: personId },
      );
    const credits: Map<number, PersonMovieCastCredit> = new Map();

    fetchResponse.dionysus_movie_cast.forEach((result) => {
      if (!result.movie) {
        return;
      }

      if (!credits.has(result.movie.id)) {
        credits.set(result.movie.id, {
          movie: toSparseDomainObject(result.movie),
          roles: [],
        });
      }

      // A person can have several roles on one movie.
      credits
        .get(result.movie.id)!
        .roles.push(toBaseMovieCastDomainObject(result));
    });

    return [...credits.values()];
  }

  /** A person's movie crew credits, one per movie, newest release first. */
  async listMovieCrewJobs(personId: number): Promise<PersonMovieCrewCredit[]> {
    const fetchRequest = gql`
      query ListMovieCrewJobsForPerson($id: numeric!) {
        dionysus_movie_crew(
          where: { personId: { _eq: $id } }
          order_by: { movie: { releaseDate: desc } }
        ) {
          createdTime
          creditId
          department
          job
          lastUpdatedTime
          movie {
            ${MOVIE_SUMMARY_WITH_SEARCH_CONFIGURATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListPersonCrewCreditsResponse>(
        fetchRequest,
        { id: personId },
      );
    const credits: Map<number, PersonMovieCrewCredit> = new Map();

    fetchResponse.dionysus_movie_crew.forEach((result) => {
      if (!result.movie) {
        return;
      }

      if (!credits.has(result.movie.id)) {
        credits.set(result.movie.id, {
          movie: toSparseDomainObject(result.movie),
          jobs: [],
        });
      }

      // A person can have several jobs on one movie.
      credits
        .get(result.movie.id)!
        .jobs.push(toBaseMovieCrewDomainObject(result));
    });

    return [...credits.values()];
  }
}
