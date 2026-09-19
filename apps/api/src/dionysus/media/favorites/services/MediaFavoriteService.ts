import { MediaAssetSearchType, MediaFavorite } from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaFavoriteConverter";
import { DECORATED_MEDIA_FAVORITE } from "../queries/mediaFavorite";
import { GraphQlMediaFavorite } from "../types/mediaFavorite";

type GraphQlGetMediaIdResponse = {
  dionysus_media_id_one: {
    id: number;
  } | null;
};

type GraphQlCreateMediaFavoriteResponse = {
  insert_dionysus_media_favorite_one: GraphQlMediaFavorite;
};

type GraphQlDeleteMediaFavoriteResponse = {
  delete_dionysus_media_favorite_by_pk: GraphQlMediaFavorite | null;
};

/** Dionysus media favorites in Hasura. */
@Injectable()
export class MediaFavoriteService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Marks a movie or TV item as a favorite.
   * @throws BadRequestException for an unsupported media type
   * @throws NotFoundException when the media does not exist
   */
  async create(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaFavorite> {
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

    if (!findMediaIdResponse.dionysus_media_id_one?.id) {
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

    return toDomainObject(insertResponse.insert_dionysus_media_favorite_one);
  }

  /** Removes a favorite, returning it. @throws NotFoundException */
  async delete(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaFavorite> {
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

    if (!deleteResponse.delete_dionysus_media_favorite_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(deleteResponse.delete_dionysus_media_favorite_by_pk);
  }
}
