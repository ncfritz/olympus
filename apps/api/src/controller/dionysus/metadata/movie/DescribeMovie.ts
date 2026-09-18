import { DescribeMovieResponse, Movie } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
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
import { MOVIE } from "../../../../query/dionysus/metadata/movies";
import { GraphQlMovie } from "../../../../types/dionysus/metadata/movie";
import { toDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMovieResponse = {
  dionysus_movies_by_pk: GraphQlMovie;
};

@Controller({ version: "1" })
export class DescribeMovieController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId")
  @ApiOperation({
    summary: "Describes a movie in Dionysus",
    description: "Retrieves the details of a movie in Dionysus.",
    operationId: "DescribeMovie",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    description: "The ID of the movie to describe",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeMovieResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId") movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchMovie($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          ${MOVIE}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieResponse>(fetchRequest, {
        id: movieId,
      });

    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const fetchedMovie: Movie = toDomainObject(
      fetchResponse.dionysus_movies_by_pk,
    );

    const responseBody: DescribeMovieResponse = {
      movie: fetchedMovie,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
