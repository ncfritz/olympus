import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  ContentAssetTag,
  ListContentAssetTagsForAssetResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetTagConverter";
import { GraphQlContentAssetTag } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQLListContentAssetTagsInput = {
  contentId: string;
};

type GraphQLListContentAssetTagsResponse = {
  dionysus_content_tags: GraphQlContentAssetTag[];
};

@Controller()
export class ListContentAssetTagsForAssetController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/asset/:assetId/tags")
  @ApiOperation({
    summary: "Lists the content asset tags for a content asset",
    description: "Lists the content asset tags associated with a content asset",
    operationId: "ListContentAssetTagsForAsset",
  })
  @ApiTags("Content")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to the tags for",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: ListContentAssetTagsForAssetResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query ListContentAssetTagsForAsset($contentId: uuid!) {
        dionysus_content_tags(
          where: { tagged_content: { content_id: { _eq: $contentId } } }
        ) {
          type
          name
          content_tag_id
          createdTime
        }
      }
    `;

    const queryResponse = await this.graphQLClient.request<
      GraphQLListContentAssetTagsResponse,
      GraphQLListContentAssetTagsInput
    >(queryRequest, {
      contentId: assetId,
    });

    const tags: ContentAssetTag[] = [];
    3;
    queryResponse.dionysus_content_tags.forEach((responseTag) => {
      tags.push(toDomainObject(responseTag));
    });

    const responseBody: ListContentAssetTagsForAssetResponse = {
      tags: tags,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
