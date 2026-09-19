import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiGoneResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class DeleteContentAssetTagFromAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/content/asset/:assetId/tag/:tagId")
  @ApiOperation({
    summary: "Removes a content asset tag from a content asset",
    description: "Removes a content asset tag from a content asset.",
    operationId: "DeleteContentAssetTagFromAsset",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description:
      "The ID of the content asset to remove the content asset tag from",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "tagId",
    description: "The ID of content asset tag to remove from the content asset",
    type: String,
    required: true,
  })
  @ApiGoneResponse({
    description: "The content asset tag was successfully removed.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Param("tagId") tagId: string,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation RemoveContentAssetTag($content_id: uuid, $content_tag_id: uuid) {
        delete_dionysus_content_asset_tags(
          where: {
            _and: {
              content_id: { _eq: $content_id }
              content_tag_id: { _eq: $content_tag_id }
            }
          }
        ) {
          affected_rows
        }
      }
    `;

    await this.graphQLClient.request(updateRequest, {
      content_id: assetId,
      content_tag_id: tagId,
    });

    response.status(HttpStatus.GONE).send({});
  }
}
