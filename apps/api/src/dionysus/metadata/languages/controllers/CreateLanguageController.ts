import {
  CreateLanguageRequest,
  CreateLanguageResponse,
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
import { LanguageService } from "../services/LanguageService";

@Controller({ version: "1" })
export class CreateLanguageController {
  constructor(private readonly languages: LanguageService) {}

  @Put("/metadata/languages")
  @ApiOperation({
    summary: "Upserts a language",
    description: "Creates or updates a language.",
    operationId: "CreateLanguage",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateLanguageRequest,
    required: true,
    description: "Input for the CreateCLanguage operation",
  })
  @ApiCreatedResponse({
    type: CreateLanguageResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateLanguageRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateLanguageResponse = {
      language: await this.languages.create(request.language),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
