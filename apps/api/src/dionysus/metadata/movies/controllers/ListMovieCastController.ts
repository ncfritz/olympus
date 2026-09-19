import { ListMovieCastResponse, MovieCastMember } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
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
import { toMovieCastDomainObject } from "../../converters/CastConverter";
import { MOVIE_CAST_MEMBER } from "../queries/movies";
import { GraphQlMovieCastMember } from "../../types/metadata";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMovieCastResponse = {
  dionysus_movie_cast: GraphQlMovieCastMember[];
};

@Controller({ version: "1" })
export class ListMovieCastController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId/cast")
  @ApiOperation({
    summary: "Lists movie cast members",
    description:
      "Lists the full cast for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCastResponse,
    description: "The list of movie cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieCast($id: numeric!) {
        dionysus_movie_cast(
          order_by: { order: asc }
          where: { movieId: { _eq: $id } }
        ) {
          ${MOVIE_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCastResponse>(
        fetchRequest,
        { id: movieId },
      );
    const cast: MovieCastMember[] = [];

    fetchResponse.dionysus_movie_cast.forEach((result) => {
      if (result.person) {
        cast.push(toMovieCastDomainObject(result));
      }
    });

    const responseBody: ListMovieCastResponse = {
      cast: cast,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
