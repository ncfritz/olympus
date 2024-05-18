import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
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
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/CountryConverter";
import { GraphQlCountry } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateCoountryResponse = {
  insert_dionysus_countries_one: GraphQlCountry;
};

@Controller()
export class CreateCountryController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Put("/v1/metadata/countries")
  @ApiOperation({
    summary: "Upserts a country",
    description: "Creates or updates a country.",
    operationId: "CreateCountry",
  })
  @ApiTags("Metadata")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCountryRequest,
    required: true,
    description: "Input for the CreateCertification operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateCountryRequest,
    headers: {
      Location: {
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
      await this.graphQLClient.request<GraphQlCreateCoountryResponse>(
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
        `http://localhost:3000/api/v1/metdata/contry/${createdCountry.id}`,
      )
      .send(responseBody);
  }
}
