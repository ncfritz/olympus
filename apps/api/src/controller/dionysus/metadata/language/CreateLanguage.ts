import {
  Language,
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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/LanguageConverter";
import { GraphQlLanguage } from "../../../../types/dionysus/metadata/language";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateLanguageResponse = {
  insert_dionysus_languages_one: GraphQlLanguage;
};

@Controller({ version: "1" })
export class CreateLanguageController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateLanguageRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateLanguage(
        $id: String!
        $name: String!
        $nativeName: String!
      ) {
        insert_dionysus_languages_one(
          object: { id: $id, name: $name, nativeName: $nativeName }
          on_conflict: {
            constraint: languages_pkey
            update_columns: [name, nativeName]
          }
        ) {
          id
          name
          nativeName
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateLanguageResponse>(
        insertRequest,
        {
          id: request.language.id,
          name: request.language.name,
          nativeName: request.language.nativeName,
        },
      );

    const createdLanguage: Language = toDomainObject(
      insertResponse.insert_dionysus_languages_one,
    );

    const responseBody: CreateLanguageResponse = {
      language: createdLanguage,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/language/${createdLanguage.id}`,
      )
      .send(responseBody);
  }
}
