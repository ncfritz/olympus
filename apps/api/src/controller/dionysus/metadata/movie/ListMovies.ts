import {
  ListMoviesResponse,
  SortDirection,
  SparseMovie,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toSparseDomainObject as toDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import { GraphQlSparseMovie } from "../../../../types/dionysus/metadata/movie";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

export type GraphQlListMoviesResponse = {
  dionysus_movies: GraphQlSparseMovie[];
  dionysus_movies_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMoviesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movies")
  @ApiOperation({
    summary: "Lists movies",
    description:
      "Lists movies.  This API accepts pagination and filter parameters to refine the " +
      "list of movies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMovies",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of movies.  If there are more movies to list, a pagination token will be present.",
    type: () => ListMoviesResponse,
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
      query ListMovies {
        dionysus_movies(${[paginationExpression, whereExpression].join(", ")}) {
          id
          adult
          backdropPath
          budget
          createdTime
          homepage
          imdbId
          lastUpdatedTime
          originalTitle
          overview
          posterPath
          releaseDate
          revenue
          runtime
          status
          tagline
          title
          video
          popularity
          voteAverage
          voteCount
          genres {
            genre {
              createdTime
              id
              lastUpdatedTime
              name
              type
            }
            createdTime
            lastUpdatedTime
          }
          ${SEARCH_CONFIGURATION}
          ${MEDIA_ASSET}
        }
        dionysus_movies_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMoviesResponse>(fetchRequest);
    const fetchedMovies: SparseMovie[] = [];

    fetchResponse.dionysus_movies.forEach((result) => {
      fetchedMovies.push(toDomainObject(result));
    });

    const responseBody: ListMoviesResponse = {
      movies: fetchedMovies,
      count: fetchResponse.dionysus_movies_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
