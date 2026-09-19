import {
  CreateMovieRequest,
  CreateMovieResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMovieController } from "./DescribeMovieController";
import { setLocation } from "../../../../utils/location";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class CreateMovieController {
  constructor(private readonly movies: MovieService) {}

  @Put("/metadata/movies")
  @ApiOperation({
    summary: "Upserts a movie",
    description: "Creates or updates a movie.",
    operationId: "CreateMovie",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMovieRequest,
    required: true,
    description: "Input for the CreateMovie operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateMovieResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created movie1",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMovieRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const movieId = await this.movies.create(request.movie);

    const responseBody = {
      id: movieId,
    };

    setLocation(response, httpRequest, DescribeMovieController, {
      movieId: movieId,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
