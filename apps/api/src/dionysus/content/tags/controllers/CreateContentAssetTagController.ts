import {
  ContentAssetTag,
  CreateContentAssetTagRequest,
  CreateContentAssetTagResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ConflictException,
  Controller,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/ContentAssetTagConverter";
import { GraphQlContentAssetTag } from "../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQLCreateContentAssetResponse = {
  insert_dionysus_content_tags_one: GraphQlContentAssetTag;
};

@Controller({ version: "1" })
export class CreateContentAssetTagController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Post("/content/assetTags")
  @ApiOperation({
    summary: "Creates a new content asset tag",
    description:
      "Creates a new content asset tag that can then be added to content assets.",
    operationId: "CreateContentAssetTag",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetTagRequest,
    required: true,
    description: "Input for the CreateContentAssetTag operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetTagResponse,
  })
  @ApiConflictResponse({
    description: "A tag with the same name and type already exists",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetTagRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateTag($type: String, $name: String) {
        insert_dionysus_content_tags_one(
          object: { name: $name, type: $type }
          on_conflict: { constraint: content_tags_name_type_key }
        ) {
          name
          type
          createdTime
          content_tag_id
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQLCreateContentAssetResponse>(
        insertRequest,
        {
          name: request.tag.name,
          type: request.tag.type,
        },
      );

    if (!insertResponse.insert_dionysus_content_tags_one) {
      throw new ConflictException(
        "An existing tag with the specified tye and name already exists",
      );
    }

    const createdContentAssetTag: ContentAssetTag = toDomainObject(
      insertResponse.insert_dionysus_content_tags_one,
    );

    const responseBody: CreateContentAssetTagResponse = {
      tag: createdContentAssetTag,
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
