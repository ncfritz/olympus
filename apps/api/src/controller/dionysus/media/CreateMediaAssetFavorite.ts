import {
  MediaFavorite,
  MediaAssetSearchType,
  SingleMediaFavoriteResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from "@nestjs/common";
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

type GraphQlGetMediaIdResponse = {
  dionysus_media_id_one: {
    id: number;
  };
};

type GraphQlCreateMediaFavoriteResponse = {
  insert_dionysus_media_favorite_one: GraphQlMediaFavorite;
};

@Controller({ version: "1" })
export class CreateMediaFavoriteController {
  constructor(protected readonly graphQLClient: GraphQLClient) {}

  @Post("/media/favorite/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Creates a new media favorite",
    description: "Creates a new media favorite.",
    operationId: "CreateMediaFavorite",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search download is for",
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
    let mediaIdQueryRoot;

    switch (mediaType) {
      case MediaAssetSearchType.MOVIE:
        mediaIdQueryRoot = "dionysus_movies_by_pk";
        break;
      case MediaAssetSearchType.TV_EPISODE:
        mediaIdQueryRoot = "dionysus_tv_episodes_by_pk";
        break;
      case MediaAssetSearchType.TV_SERIES:
        mediaIdQueryRoot = "dionysus_tv_series_by_pk";
        break;
      case MediaAssetSearchType.TV_SEASON:
        mediaIdQueryRoot = "dionysus_tv_seasons_by_pk";
        break;
      default:
        throw new BadRequestException("Invalid media assetType");
    }

    const findMediaIdQuery = gql`query GetMediaIdForAsset($id: numeric!) {
      dionysus_media_id_one: ${mediaIdQueryRoot}(id: $id) {
        id
      }
    }`;

    const findMediaIdResponse =
      await this.graphQLClient.request<GraphQlGetMediaIdResponse>(
        findMediaIdQuery,
        { id: mediaId },
      );

    if (!findMediaIdResponse.dionysus_media_id_one.id) {
      throw new NotFoundException("Media asset not found");
    }

    const insertRequest = gql`
      mutation CreateMediaFavorite(
        $assetType: String!
        $mediaId: numeric!
      ) {
        insert_dionysus_media_favorite_one(
          object: {
            type: $assetType
            mediaId: $mediaId
          }
        ) {
          ${DECORATED_MEDIA_FAVORITE}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaFavoriteResponse>(
        insertRequest,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    const createdFavorite: MediaFavorite = toDomainObject(
      insertResponse.insert_dionysus_media_favorite_one,
    );

    const responseBody: SingleMediaFavoriteResponse = {
      favorite: createdFavorite,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/favorite/${mediaType}/${mediaId}`,
      )
      .send(responseBody);
  }
}
