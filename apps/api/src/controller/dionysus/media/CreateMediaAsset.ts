import {
  CreateMediaAssetRequest,
  MediaAsset,
  SingleMediaAssetResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetConverter";
import { BASE_MEDIA_ASSET } from "../../../query/dionysus/media/mediaAsset";
import { GraphQlMediaAsset } from "../../../types/dionysus/media/mediaAsset";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlCreateMediaAssetResponse = {
  insert_dionysus_media_asset_one: GraphQlMediaAsset;
};

@Controller({ version: "1" })
export class CreateMediaAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Post("/media/assets")
  @ApiOperation({
    summary: "Creates a new media asset",
    description: "Creates a new media asset.",
    operationId: "CreateMediaAsset",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMediaAssetRequest,
    required: true,
    description: "Input for the CreateMediaAsset operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created asset",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMediaAssetRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateMediaAsset(
        $assetType: String!
        $mediaId: numeric!
        $filePath: String!
        $assetSha: String!
        $originalSize: numeric!
        $newSize: numeric!
        $duration: numeric!
        $width: numeric!
        $height: numeric!
      ) {
        insert_dionysus_media_asset_one(
          object: {
            assetType: $assetType
            mediaId: $mediaId
            filePath: $filePath
            assetSha: $assetSha
            originalSize: $originalSize
            newSize: $newSize
            duration: $duration
            width: $width
            height: $height
          }
          on_conflict: {
            constraint: media_asset_pkey
            update_columns: [
              filePath
              assetSha
              originalSize
              newSize
              duration
              width
              height
            ]
          }
        ) {
          ${BASE_MEDIA_ASSET}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetResponse>(
        insertRequest,
        {
          assetType: request.asset.type,
          mediaId: request.asset.mediaId,
          filePath: request.asset.filePath,
          assetSha: request.asset.assetSha,
          originalSize: request.asset.originalSizeBytes,
          newSize: request.asset.newSizeBytes,
          duration: request.asset.durationMs,
          width: request.asset.width,
          height: request.asset.height,
        },
      );

    const createdMediaAsset: MediaAsset = toDomainObject(
      insertResponse.insert_dionysus_media_asset_one,
    );

    const responseBody: SingleMediaAssetResponse = {
      asset: createdMediaAsset,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/asset/${createdMediaAsset.type}/${createdMediaAsset.mediaId}`,
      )
      .send(responseBody);
  }
}
