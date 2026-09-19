import {
  CreateGenreRequest,
  CreateGenreResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class CreateGenreController {
  constructor(private readonly genres: GenreService) {}

  @Put("/metadata/genres")
  @ApiOperation({
    summary: "Upserts a Movie or TV genre",
    description: "Creates or updates a movie or TV genre.",
    operationId: "CreateGenre",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateGenreRequest,
    required: true,
    description: "Input for the CreateGenre operation",
  })
  @ApiCreatedResponse({
    type: CreateGenreResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateGenreRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateGenreResponse = {
      genre: await this.genres.create(request.genre),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
