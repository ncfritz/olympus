import { BaseMediaAsset, MediaAsset } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetConverter";
import { BASE_MEDIA_ASSET } from "../queries/mediaAsset";
import { GraphQlMediaAsset } from "../types/mediaAsset";

type GraphQlCreateMediaAssetResponse = {
  insert_dionysus_media_asset_one: GraphQlMediaAsset;
};

/** Dionysus media assets (files on disk) in Hasura. */
@Injectable()
export class MediaAssetService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates a media asset, or updates the file details of an existing one. */
  async create(asset: BaseMediaAsset): Promise<MediaAsset> {
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
          assetType: asset.type,
          mediaId: asset.mediaId,
          filePath: asset.filePath,
          assetSha: asset.assetSha,
          originalSize: asset.originalSizeBytes,
          newSize: asset.newSizeBytes,
          duration: asset.durationMs,
          width: asset.width,
          height: asset.height,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_media_asset_one);
  }
}
