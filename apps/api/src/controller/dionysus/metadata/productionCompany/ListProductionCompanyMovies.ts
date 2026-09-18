import {
  ListProductionCompanyMoviesResponse,
  SortDirection,
  SparseMovie,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toSparseDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { GraphQlSparseMovie } from "../../../../types/dionysus/metadata/movie";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListProductionCompanyMoviesResponse = {
  dionysus_production_companies_by_pk: {
    movies: {
      movie: GraphQlSparseMovie;
    }[];
    movies_aggregate: {
      aggregate: {
        count: number;
      };
    };
  };
};

@Controller({ version: "1" })
export class ListProductionCompanyMoviesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/productionCompany/:productionCompanyId/movies")
  @ApiOperation({
    summary: "Lists the movies associated with a production company",
    description:
      "Lists the movies associated with a production company.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListProductionCompanyMovies",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to list movies for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListProductionCompanyMoviesResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("productionCompanyId") productionCompanyId: number,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const queryParams = [
      `limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}`,
    ];

    const fetchRequest = gql`
      query ListProductionCompanyMovies($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
          movies(${queryParams.join(", ")}) {
            movie {
              adult
              backdropPath
              budget
              createdTime
              homepage
              id
              imdbId
              lastUpdatedTime
              originalLanguageCode
              originalTitle
              overview
              popularity
              posterPath
              releaseDate
              revenue
              runtime
              status
              tagline
              title
              voteAverage
              voteCount
              video
            }
          }
          movies_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListProductionCompanyMoviesResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );
    const movies: SparseMovie[] = [];

    fetchResponse.dionysus_production_companies_by_pk.movies.forEach(
      (result) => {
        movies.push(toSparseDomainObject(result.movie));
      },
    );

    const responseBody: ListProductionCompanyMoviesResponse = {
      movies: movies,
      count:
        fetchResponse.dionysus_production_companies_by_pk.movies_aggregate
          .aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
