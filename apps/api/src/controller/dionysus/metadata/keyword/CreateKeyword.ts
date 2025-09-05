import {
  Keyword,
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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/KeywordConverter";
import { GraphQlKeyword } from "../../../../types/dionysus/metadata/keyword";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateKeywordResponse = {
  insert_dionysus_keywords_one: GraphQlKeyword;
};

@Controller({ version: "1" })
export class CreateKeywordController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateKeywordRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateKeyword($id: numeric!, $value: String!) {
        insert_dionysus_keywords_one(
          object: { id: $id, value: $value }
          on_conflict: { constraint: keywords_pkey, update_columns: [value] }
        ) {
          id
          value
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateKeywordResponse>(
        insertRequest,
        {
          id: request.keyword.id,
          value: request.keyword.value,
        },
      );

    const createdKeyword: Keyword = toDomainObject(
      insertResponse.insert_dionysus_keywords_one,
    );

    const responseBody: CreateKeywordResponse = {
      keyword: createdKeyword,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/keyword/${createdKeyword.id}`,
      )
      .send(responseBody);
  }
}
