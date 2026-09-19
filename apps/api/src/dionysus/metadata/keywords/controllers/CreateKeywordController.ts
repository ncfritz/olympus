import {
  CreateKeywordRequest,
  CreateKeywordResponse,
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
import { KeywordService } from "../services/KeywordService";

@Controller({ version: "1" })
export class CreateKeywordController {
  constructor(private readonly keywords: KeywordService) {}

  @Put("/metadata/keywords")
  @ApiOperation({
    summary: "Upserts a Movie or TV keyword",
    description: "Creates or updates a movie or TV keyword.",
    operationId: "CreateKeyword",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateKeywordRequest,
    required: true,
    description: "Input for the CreateKeyword operation",
  })
  @ApiCreatedResponse({
    type: CreateKeywordResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateKeywordRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateKeywordResponse = {
      keyword: await this.keywords.create(request.keyword),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
