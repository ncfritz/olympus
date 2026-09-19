import {
  CreateCountryRequest,
  CreateCountryResponse,
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
import { CountryService } from "../services/CountryService";

@Controller({ version: "1" })
export class CreateCountryController {
  constructor(private readonly countries: CountryService) {}

  @Put("/metadata/countries")
  @ApiOperation({
    summary: "Upserts a country",
    description: "Creates or updates a country.",
    operationId: "CreateCountry",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCountryRequest,
    required: true,
    description: "Input for the CreateCertification operation",
  })
  @ApiCreatedResponse({
    type: CreateCountryResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCountryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateCountryResponse = {
      country: await this.countries.create(request.country),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
