import {
  MediaAssetSearchConfiguration,
  MediaAssetSearchType,
} from "@ncfritz/olympus-model";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { BASE_SEARCH_CONFIGURATION } from "../../../query/dionysus/media/searchConfigutation";
import { GraphQlMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";

type GraphQlGetMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration_by_pk: GraphQlMediaAssetSearchConfiguration;
};
type GraphQlVerifySearchConfigResponse = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
  };
};

export abstract class BaseMediaAssetSearchConfigurationController {
  protected constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async fetchMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaAssetSearchConfiguration> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_configuration_by_pk(
          assetType: $assetType
          mediaId: $mediaId
        ) {
          ${BASE_SEARCH_CONFIGURATION}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchConfigurationResponse>(
        fetchRequest,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_search_configuration_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      fetchResponse.dionysus_media_asset_search_configuration_by_pk,
    );
  }

  protected async verifySearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<void> {
    const verifyQuery = gql`
      query VerifyMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_configuration_by_pk(
          assetType: $assetType
          mediaId: $mediaId
        ) {
          assetType
          mediaId
        }
      }
    `;

    const verifyResponse =
      await this.graphQLClient.request<GraphQlVerifySearchConfigResponse>(
        verifyQuery,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (
      !(
        verifyResponse.dionysus_media_asset_search_configuration_by_pk
          .assetType &&
        verifyResponse.dionysus_media_asset_search_configuration_by_pk.mediaId
      )
    ) {
      throw new BadRequestException(
        "Source search configuration definition could not be found",
      );
    }
  }
}
