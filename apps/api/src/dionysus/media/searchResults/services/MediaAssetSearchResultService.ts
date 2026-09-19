import {
  FilterDefinition,
  FilterType,
  MediaAssetSearchResult,
  MediaAssetSearchType,
  PartialMediaAssetSearchResult,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetSearchResultConverter";
import { BASE_SEARCH_RESULT } from "../queries/searchResult";
import { GraphQlMediaAssetSearchResult } from "../types/searchResult";
import { MediaAssetSearchConfigurationService } from "../../searchConfigurations/services/MediaAssetSearchConfigurationService";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";

type GraphQlVerifySearchResultResponse = {
  dionysus_media_asset_search_result_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
    id: string;
  } | null;
};

type GraphQlCreateMediaAssetSearchResultResponse = {
  insert_dionysus_media_asset_search_result_one: GraphQlMediaAssetSearchResult;
};

type GraphQlGetMediaAssetSearchResultResponse = {
  dionysus_media_asset_search_result_by_pk: GraphQlMediaAssetSearchResult;
};

type GraphQlListMediaAssetSearchResultResponse = {
  dionysus_media_asset_search_result: GraphQlMediaAssetSearchResult[];
  dionysus_media_asset_search_result_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** A page of search results plus the total matching count. */
export type MediaAssetSearchResultList = {
  searchResults: MediaAssetSearchResult[];
  count: number;
};

/** Results of media asset searches in Hasura. */
@Injectable()
export class MediaAssetSearchResultService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  /** Checks that a search result exists. @throws NotFoundException */
  async verifyExists(
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

    if (!verifyResponse.dionysus_media_asset_search_result_by_pk) {
      throw new NotFoundException(
        `Search result ${mediaType}/${mediaId}/${id} not found`,
      );
    }
  }

  /** Records a result of a search configuration. @throws NotFoundException */
  async create(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchResult: PartialMediaAssetSearchResult,
  ): Promise<MediaAssetSearchResult> {
    await this.searchConfigurations.verifyExists(mediaType, mediaId);

    const insertRequest = gql`
      mutation CreateMediaAssetSearchResult(
        $id: String!
        $assetType: String!
        $mediaId: numeric!
        $title: String!
        $score: numeric!
        $size: numeric!
        $password: numeric!
        $quality: String!
        $qualityGroup: String!
        $source: numeric!
        $modifier: numeric!
        $resolution: numeric!
        $repack: Boolean!
        $postedTime: timestamptz!
        $tags: [dionysus_media_asset_search_result_tag_insert_input!]!
      ) {
        insert_dionysus_media_asset_search_result_one(
          object: {
            id: $id
            assetType: $assetType
            mediaId: $mediaId
            title: $title
            score: $score
            size: $size
            password: $password
            quality: $quality
            qualityGroup: $qualityGroup
            source: $source
            modifier: $modifier
            resolution: $resolution
            repack: $repack
            postedTime: $postedTime
            tags: {
              data: $tags
            }
          }
        ) {
          ${BASE_SEARCH_RESULT}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchResultResponse>(
        insertRequest,
        {
          id: searchResult.id,
          title: searchResult.title,
          score: searchResult.score,
          assetType: mediaType,
          mediaId: mediaId,
          size: searchResult.size,
          password: searchResult.password,
          quality: searchResult.quality,
          qualityGroup: searchResult.qualityGroup,
          source: searchResult.source,
          modifier: searchResult.modifier,
          resolution: searchResult.resolution,
          repack: searchResult.repack,
          postedTime: searchResult.postedTime,
          tags: searchResult.tags || [],
        },
      );

    return toDomainObject(
      insertResponse.insert_dionysus_media_asset_search_result_one,
    );
  }

  /** @throws NotFoundException */
  async describe(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
  ): Promise<MediaAssetSearchResult> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchResult(
        $resultId: String!
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_result_by_pk(
          id: $resultId
          assetType: $assetType
          mediaId: $mediaId
        ) {
          ${BASE_SEARCH_RESULT}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchResultResponse>(
        fetchRequest,
        {
          resultId: resultId,
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_search_result_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      fetchResponse.dionysus_media_asset_search_result_by_pk,
    );
  }

  /** Results of a search configuration, narrowed by `userFilters`. */
  async list(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    pagination: PaginationParams,
    userFilters: FilterDefinition | undefined,
  ): Promise<MediaAssetSearchResultList> {
    const searchConfigurationFilter: FilterDefinition = {
      type: FilterType.AND,
      name: "_",
      value: [
        {
          type: FilterType.EQUALS,
          name: "assetType",
          value: mediaType,
        },
        {
          type: FilterType.EQUALS,
          name: "mediaId",
          value: mediaId,
        },
      ],
    };

    const listFilters: FilterDefinition = userFilters
      ? {
          type: FilterType.AND,
          name: "_",
          value: [searchConfigurationFilter, userFilters],
        }
      : searchConfigurationFilter;

    const whereExpression = buildFilterExpression(listFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMediaAssetSearchResults {
        dionysus_media_asset_search_result(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_SEARCH_RESULT}
        }
        dionysus_media_asset_search_result_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetSearchResultResponse>(
        fetchRequest,
      );
    const fetchedResults: MediaAssetSearchResult[] = [];

    fetchResponse.dionysus_media_asset_search_result.forEach((result) => {
      fetchedResults.push(toDomainObject(result));
    });

    return {
      searchResults: fetchedResults,
      count:
        fetchResponse.dionysus_media_asset_search_result_aggregate.aggregate
          .count,
    };
  }
}
