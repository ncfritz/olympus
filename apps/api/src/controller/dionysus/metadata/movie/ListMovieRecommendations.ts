import {
  ListMovieRecommendationsResponse,
  SparseMovie,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toSparseDomainObject as toMovieDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { BASE_MOVIE_RECOMMENDATION } from "../../../../query/dionysus/metadata/movies";
import { GraphQlMovieRecommendation } from "../../../../types/dionysus/metadata/movie";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMovieRecommendationsResponse = {
  dionysus_movies_by_pk: {
    recommendations: GraphQlMovieRecommendation[];
  };
};

@Controller({ version: "1" })
export class ListMovieRecommendationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId/recommendations")
  @ApiOperation({
    summary: "Lists movie recommendations",
    description:
      "Lists the recommendations for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieRecommendations",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieRecommendationsResponse,
    description: "The list of movie recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieRecommendations($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          recommendations {
            ${BASE_MOVIE_RECOMMENDATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieRecommendationsResponse>(
        fetchRequest,
        { id: movieId },
      );
    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const recommendations: SparseMovie[] = [];

    fetchResponse.dionysus_movies_by_pk.recommendations.forEach((result) => {
      recommendations.push(toMovieDomainObject(result.movie));
    });

    const responseBody: ListMovieRecommendationsResponse = {
      recommendations: recommendations,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
