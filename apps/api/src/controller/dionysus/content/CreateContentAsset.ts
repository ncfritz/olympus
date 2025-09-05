import {
  CreateContentAssetRequest,
  CreateContentAssetResponse,
  ContentAsset,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../../types/content";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQLCreateContentAssetResponse = {
  insert_dionysus_content_assets_one: GraphQLContentAsset;
};

@Controller({ version: "1" })
export class CreateContentAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Post("/content/assets")
  @ApiOperation({
    summary: "Creates a new content asset",
    description:
      "Creates a new content asset.  New assets are assigned their ID by the ingestion process.",
    operationId: "CreateContentAsset",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetRequest,
    required: true,
    description: "Input for the CreateContentAsset operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetResponse,
    headers: {
      Location: {
        description: "The location of the created content asset",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateContentAsset(
        $asset_sha: String
        $asset_size: numeric
        $content_id: uuid
        $duration: numeric
        $height: numeric
        $original_name: String
        $original_sha: String
        $original_size: numeric
        $width: numeric
      ) {
        insert_dionysus_content_assets_one(
          object: {
            asset_sha: $asset_sha
            asset_size: $asset_size
            content_id: $content_id
            duration: $duration
            height: $height
            original_name: $original_name
            original_sha: $original_sha
            original_size: $original_size
            width: $width
          }
        ) {
          asset_sha
          asset_size
          content_id
          createdTime
          duration
          height
          name
          original_name
          original_sha
          original_size
          rating
          width
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQLCreateContentAssetResponse>(
        insertRequest,
        {
          asset_sha: request.asset.newSha,
          asset_size: request.asset.newSizeBytes,
          content_id: request.asset.id,
          duration: request.asset.durationMs,
          height: request.asset.height,
          original_name: request.asset.originalName,
          original_sha: request.asset.originalSha,
          original_size: request.asset.originalSizeBytes,
          width: request.asset.width,
        },
      );

    const createdContentAsset: ContentAsset = toDomainObject(
      insertResponse.insert_dionysus_content_assets_one,
    );

    const responseBody: CreateContentAssetResponse = {
      asset: createdContentAsset,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/content/assets/${createdContentAsset.id}`,
      )
      .send(responseBody);
  }
}
