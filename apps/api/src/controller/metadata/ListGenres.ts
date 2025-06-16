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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/GenreConverter";
import { GraphQlGenre } from "../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListGenresResponse = {
  dionysus_genres: GraphQlGenre[];
  dionysus_genres_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListGenresController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/metadata/genres")
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
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of genres.  If there are more genres to list, a pagination token will be present.",
    type: () => ListGenresResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListGenres {
      dionysus_genres(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}) {
        id
        type
        name
        createdTime
        lastUpdatedTime
      }
      dionysus_genres_aggregate {
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
