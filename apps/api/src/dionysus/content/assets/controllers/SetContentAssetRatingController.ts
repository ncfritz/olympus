import {
  SetContentAssetRatingRequest,
  EmptyResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class SetContentAssetRatingController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/content/asset/:assetId/rating")
  @ApiOperation({
    summary: "Sets the rating for a content asset",
    description: "Sets the rating for a content asset.",
    operationId: "SetContentAssetRating",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to set the rating on",
    type: String,
    required: true,
  })
  @ApiBody({
    type: SetContentAssetRatingRequest,
    required: true,
    description: "Input for the SetContentAssetRating operation",
  })
  @ApiOkResponse({
    description: "The rating was successfully set.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Body() request: SetContentAssetRatingRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation SetContentAssetRating($content_id: uuid!, $rating: numeric) {
        update_dionysus_content_assets_by_pk(
          pk_columns: { content_id: $content_id }
          _set: { rating: $rating }
        ) {
          rating
        }
      }
    `;

    await this.graphQLClient.request(updateRequest, {
      content_id: assetId,
      rating: request.rating,
    });

    response.status(HttpStatus.OK).send({});
  }
}
