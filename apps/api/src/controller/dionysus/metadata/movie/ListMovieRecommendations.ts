import {
  ListMovieRecommendationsResponse,
  SparseMovie,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toSparseDomainObject as toMovieDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
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
    @Param("movieId") movieId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieRecommendations($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          recommendations {
            created_at
            updated_at
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
              ${SEARCH_CONFIGURATION}
              ${MEDIA_ASSET}
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieRecommendationsResponse>(
        fetchRequest,
        { id: movieId },
      );
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
