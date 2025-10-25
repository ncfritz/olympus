import {
  BasePerson,
  ListPeopleResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject as toDomainObject } from "../../../../convert/dionysus/metadata/PersonConverter";
import { GraphQlBasePerson } from "../../../../types/dionysus/metadata/person";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

export type GraphQlListPeopleResponse = {
  dionysus_people: GraphQlBasePerson[];
  dionysus_people_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListPeopleController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/people")
  @ApiOperation({
    summary: "Lists people",
    description:
      "Lists people.  This API accepts pagination and filter parameters to refine the " +
      "list of people fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListPeople",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of people.  If there are more people to list, a pagination token will be present.",
    type: () => ListPeopleResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "popularity",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListBatchJobs {
        dionysus_people(${[paginationExpression, whereExpression].join(", ")}) {
          id
          name
          adult
          birthday
          birthplace
          deathday
          gender
          homepage
          imdbId
          knownForDepartment
          profilePath
          popularity
          createdTime
          lastUpdatedTime
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
    const fetchedPeople: BasePerson[] = [];

    fetchResponse.dionysus_people.forEach((result) => {
      fetchedPeople.push(toDomainObject(result));
    });

    const responseBody: ListPeopleResponse = {
      people: fetchedPeople,
      count: fetchResponse.dionysus_people_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
