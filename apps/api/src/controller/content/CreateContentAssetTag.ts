import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  ContentAssetTag,
  CreateContentAssetTagRequest,
  CreateContentAssetTagResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetTagConverter";
import { GraphQlContentAssetTag } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQLCreateContentAssetResponse = {
  insert_dionysus_content_tags_one: GraphQlContentAssetTag;
};

@Controller()
export class CreateContentAssetTagController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Post("/v1/content/assetTags")
  @ApiOperation({
    summary: "Creates a new content asset",
    description:
      "Creates a new content asset.  New assets are assigned their ID by the ingestion process.",
    operationId: "CreateContentAssetTag",
  })
  @ApiTags("Content")
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
    headers: {
      Location: {
        description: "The location of the created content asset",
      },
    },
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
      response.status(HttpStatus.CONFLICT).end();
      return;
    }

    const createdContentAssetTag: ContentAssetTag = toDomainObject(
      insertResponse.insert_dionysus_content_tags_one,
    );

    const responseBody: CreateContentAssetTagResponse = {
      tag: createdContentAssetTag,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/content/assetTag/${createdContentAssetTag.id}`,
      )
      .send(responseBody);
  }
}
