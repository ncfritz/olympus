import {
  MediaFavorite,
  MediaAssetSearchType,
  SingleMediaFavoriteResponse,
} from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaFavoriteConverter";
import { DECORATED_MEDIA_FAVORITE } from "../../../query/dionysus/media/mediaFavorite";
import { GraphQlMediaFavorite } from "../../../types/dionysus/media/mediaFavorite";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlDeleteMediaFavoriteResponse = {
  delete_dionysus_media_favorite_by_pk: GraphQlMediaFavorite;
};

@Controller({ version: "1" })
export class DeleteMediaFavoriteController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Delete("/media/favorite/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Creates a new media favorite",
    description: "Creates a new media favorite.",
    operationId: "DeleteMediaFavorite",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type media asset the search download is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
  })
  @ApiParam({
    name: "mediaId",
    description: "The ID of the media that the download is targeting.",
    type: Number,
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaFavoriteResponse,
    headers: {
      Location: {
        description: "The location of the media favorite record",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteMediaFavorite($mediaId: numeric!, $assetType: String!) {
        delete_dionysus_media_favorite_by_pk(
          mediaId: $mediaId
          type: $assetType
        ) {
          ${DECORATED_MEDIA_FAVORITE}
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteMediaFavoriteResponse>(
        deleteRequest,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    const deletedFavorite: MediaFavorite = toDomainObject(
      deleteResponse.delete_dionysus_media_favorite_by_pk,
    );

    const responseBody: SingleMediaFavoriteResponse = {
      favorite: deletedFavorite,
    };

    response.status(HttpStatus.GONE).send(responseBody);
  }
}
