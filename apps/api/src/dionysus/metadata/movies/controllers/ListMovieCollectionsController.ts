import { ListMovieCollectionsResponse } from "@ncfritz/olympus-model";
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class ListMovieCollectionsController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movie/:movieId/collections")
  @ApiOperation({
    summary: "Lists the collections a movie belongs to",
    description:
      "Lists the set of collections a movie belongs to.  This API will return the collection details including the " +
      "parts (movies) that belong to collection.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCollections",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCollectionsResponse,
    description: "The list of collections the movie belongs to.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListMovieCollectionsResponse = {
      collections: await this.movies.listCollections(movieId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
