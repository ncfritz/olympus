import { MediaAssetSearchType } from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";

type GraphQlVerifySearchResultResponse = {
  dionysus_media_asset_search_result_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
    id: string;
  };
};

export abstract class BaseMediaAssetSearchResultController {
  protected constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async verifySearchResult(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    id: string,
  ): Promise<void> {
    const verifyQuery = gql`
      query VerifyMediaAssetSearchResult(
        $assetType: String!
        $mediaId: numeric!
        $id: String!
      ) {
        dionysus_media_asset_search_result_by_pk(
          assetType: $assetType
          mediaId: $mediaId
          id: $id
        ) {
          assetType
          mediaId
          id
        }
      }
    `;

    const verifyResponse =
      await this.graphQLClient.request<GraphQlVerifySearchResultResponse>(
        verifyQuery,
        {
          assetType: mediaType,
          mediaId: mediaId,
          id: id,
        },
      );

    if (
      !(
        verifyResponse.dionysus_media_asset_search_result_by_pk.assetType &&
        verifyResponse.dionysus_media_asset_search_result_by_pk.mediaId &&
        verifyResponse.dionysus_media_asset_search_result_by_pk.id
      )
    ) {
      throw new BadRequestException(
        "Source search result definition could not be found",
      );
    }
  }
}
