import { DescribeMovieResponse } from "@ncfritz/olympus-model";
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
export class DescribeMovieController {
  constructor(private readonly movies: MovieService) {}

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
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeMovieResponse = {
      movie: await this.movies.describe(movieId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
