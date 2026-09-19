import {
  Genre,
  ListGenresResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/GenreConverter";
import { GraphQlGenre } from "../types/genre";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

type GraphQlListGenresResponse = {
  dionysus_genres: GraphQlGenre[];
  dionysus_genres_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListGenresController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/genres")
  @ApiOperation({
    summary: "Lists genres",
    description:
      "Lists genres.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of genres fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListGenres",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListGenresResponse,
    description:
      "The list of genres.  If there are more genres to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
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
      query ListGenres {
        dionysus_genres(${[paginationExpression, whereExpression].join(", ")}) {
          id
          type
          name
          createdTime
          lastUpdatedTime
        }
        dionysus_genres_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListGenresResponse>(fetchRequest);
    const fetchedGenres: Genre[] = [];

    fetchResponse.dionysus_genres.forEach((result) => {
      fetchedGenres.push(toDomainObject(result));
    });

    const responseBody: ListGenresResponse = {
      genres: fetchedGenres,
      count: fetchResponse.dionysus_genres_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
