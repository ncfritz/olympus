import {
  Country,
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
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/CountryConverter";
import { GraphQlCountry } from "../../../../types/dionysus/metadata/country";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateCountryResponse = {
  insert_dionysus_countries_one: GraphQlCountry;
};

@Controller({ version: "1" })
export class CreateCountryController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCountryRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateCountry($id: String!, $name: String!) {
        insert_dionysus_countries_one(
          object: { id: $id, name: $name }
          on_conflict: { constraint: countries_pkey, update_columns: [name] }
        ) {
          id
          name
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCountryResponse>(
        insertRequest,
        {
          id: request.country.id,
          name: request.country.name,
        },
      );

    const createdCountry: Country = toDomainObject(
      insertResponse.insert_dionysus_countries_one,
    );

    const responseBody: CreateCountryResponse = {
      country: createdCountry,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/contry/${createdCountry.id}`,
      )
      .send(responseBody);
  }
}
