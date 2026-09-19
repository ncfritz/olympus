import {
  DecoratedMediaAssetSearchConfiguration,
  MediaAssetSearchType,
} from "@ncfritz/olympus-model";
import { NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDecoratedDomainObject } from "../converters/MediaAssetSearchConfigurationConverter";
import { BASE_DECORATED_SEARCH_CONFIGURATION } from "../queries/searchConfiguration";
import { GraphQlDecoratedMediaAssetSearchConfiguration } from "../types/searchConfiguration";

type GraphQlGetMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration_by_pk: GraphQlDecoratedMediaAssetSearchConfiguration;
};
type GraphQlVerifySearchConfigResponse = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
  } | null;
};

export abstract class BaseMediaAssetSearchConfigurationController {
  protected constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async fetchMediaAssetSearchConfiguration(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<DecoratedMediaAssetSearchConfiguration> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_configuration_by_pk(
          assetType: $assetType
          mediaId: $mediaId
        ) {
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
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

    return toDecoratedDomainObject(
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

    if (!verifyResponse.dionysus_media_asset_search_configuration_by_pk) {
      throw new NotFoundException(
        `Search configuration ${mediaType}/${mediaId} not found`,
      );
    }
  }
}
