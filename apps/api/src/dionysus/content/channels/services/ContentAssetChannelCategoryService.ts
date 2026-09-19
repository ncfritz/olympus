import {
  BaseContentAssetChannelCategory,
  FullContentAssetChannelCategory,
  ListContentAssetChannelCategoriesResponse,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { BC_CHANNEL_FILTER } from "../../auth/contentAuth";
import { ContentAuthService } from "../../auth/services/ContentAuthService";
import { GraphQlFullContentAssetChannelCategory } from "../../types/content";
import { toFullDomainObject } from "../converters/ContentAssetChannelCategoryConverter";

type GraphQlDescribeContentAssetChannelCategoryResponse = {
  dionysus_content_asset_channel_category_by_pk: GraphQlFullContentAssetChannelCategory | null;
};

type GraphQlListContentAssetChannelCategoriesResponse = {
  dionysus_content_asset_channel_category: GraphQlFullContentAssetChannelCategory[];
  dionysus_content_asset_channel_category_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlCreateContentAssetChannelCategoryResponse = {
  insert_dionysus_content_asset_channel_category_one: GraphQlFullContentAssetChannelCategory;
};

type GraphQlUpdateContentAssetChannelCategoryResponse = {
  update_dionysus_content_asset_channel_category_by_pk: GraphQlFullContentAssetChannelCategory | null;
};

/**
 * Content asset channel categories in Hasura. Methods taking an `authToken`
 * (the content auth cookie) only include bcCompliant channels when it is
 * missing or invalid.
 */
@Injectable()
export class ContentAssetChannelCategoryService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly contentAuth: ContentAuthService,
  ) {}

  /** A category with its first 10 channels. @throws NotFoundException */
  async describe(
    categoryId: string,
    authToken: string | undefined,
  ): Promise<FullContentAssetChannelCategory> {
    const channelWhere = (await this.contentAuth.authenticate(authToken, true))
      ? ""
      : (buildFilterExpression(BC_CHANNEL_FILTER) ?? "");
    const queryRequest = gql`
      query DescribeContentAssetChannelCategory($categoryId: uuid!) {
        dionysus_content_asset_channel_category_by_pk(id: $categoryId) {
          createdTime
          id
          lastUpdatedTime
          name
          channels(limit: 10${channelWhere ? `, ${channelWhere}` : ""}) {
            bcCompliant
            categoryId
            createdTime
            description
            encodedFilter
            favorite
            filterInput
            id
            jitter
            lastFetchedTime
            lastUpdatedTime
            name
            ttl
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate${channelWhere ? `(${channelWhere})` : ""} {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeContentAssetChannelCategoryResponse>(
        queryRequest,
        {
          categoryId: categoryId,
        },
      );

    if (!queryResponse.dionysus_content_asset_channel_category_by_pk) {
      throw new NotFoundException();
    }

    return toFullDomainObject(
      queryResponse.dionysus_content_asset_channel_category_by_pk,
    );
  }

  /**
   * A page of categories with their channels, with the total category count.
   * `filters` is passed to buildFilterExpression as given.
   */
  async list(
    filters: string | undefined,
    pagination: PaginationParams,
    authToken: string | undefined,
  ): Promise<ListContentAssetChannelCategoriesResponse> {
    const channelWhere = (await this.contentAuth.authenticate(authToken, true))
      ? ""
      : (buildFilterExpression(BC_CHANNEL_FILTER) ?? "");

    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListContentAssetChannelCategories {
        dionysus_content_asset_channel_category(${[paginationExpression, whereExpression].join(", ")}) {
          channels${channelWhere ? `(${channelWhere})` : ""} {
            assetCache {
              createdTime
              assetId
              width
              height
            }
            ttl
            name
            lastUpdatedTime
            lastFetchedTime
            jitter
            id
            filterInput
            favorite
            encodedFilter
            description
            createdTime
            categoryId
            bcCompliant
            assetCount
          }
          createdTime
          id
          lastUpdatedTime
          name
          channels_aggregate${channelWhere ? `(${channelWhere})` : ""} {
            aggregate {
              count
            }
          }
        }
        dionysus_content_asset_channel_category_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetChannelCategoriesResponse>(
        fetchRequest,
      );
    const fetchedCategories: FullContentAssetChannelCategory[] = [];

    fetchResponse.dionysus_content_asset_channel_category.forEach((result) => {
      fetchedCategories.push(toFullDomainObject(result));
    });

    return {
      categories: fetchedCategories,
      count:
        fetchResponse.dionysus_content_asset_channel_category_aggregate
          .aggregate.count,
    };
  }

  async create(
    category: BaseContentAssetChannelCategory,
  ): Promise<FullContentAssetChannelCategory> {
    const insertRequest = gql`
      mutation CreateContentAssetChannelCategory($name: String!) {
        insert_dionysus_content_asset_channel_category_one(
          object: { name: $name }
        ) {
          createdTime
          id
          lastUpdatedTime
          name
          channels(limit: 10) {
            bcCompliant
            categoryId
            createdTime
            description
            encodedFilter
            favorite
            filterInput
            id
            jitter
            lastFetchedTime
            lastUpdatedTime
            name
            ttl
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateContentAssetChannelCategoryResponse>(
        insertRequest,
        {
          name: category.name,
        },
      );

    return toFullDomainObject(
      insertResponse.insert_dionysus_content_asset_channel_category_one,
    );
  }

  /** @throws NotFoundException */
  async update(
    categoryId: string,
    category: BaseContentAssetChannelCategory,
  ): Promise<FullContentAssetChannelCategory> {
    const updateRequest = gql`
      mutation UpdateContentAssetChannelCategory(
        $categoryId: uuid!
        $name: String!
      ) {
        update_dionysus_content_asset_channel_category_by_pk(
          pk_columns: { id: $categoryId }
          _set: { name: $name }
        ) {
          createdTime
          id
          lastUpdatedTime
          name
          channels(limit: 10) {
            bcCompliant
            categoryId
            createdTime
            description
            encodedFilter
            favorite
            filterInput
            id
            jitter
            lastFetchedTime
            lastUpdatedTime
            name
            ttl
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentAssetChannelCategoryResponse>(
        updateRequest,
        {
          categoryId: categoryId,
          name: category.name,
        },
      );

    if (!updateResponse.update_dionysus_content_asset_channel_category_by_pk) {
      throw new NotFoundException();
    }

    return toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_category_by_pk,
    );
  }
}
