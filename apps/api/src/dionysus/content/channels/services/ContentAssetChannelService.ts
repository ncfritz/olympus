import {
  BaseContentAssetChannel,
  ContentAssetChannel,
  FilterDefinition,
  FullContentAssetChannel,
  ListContentAssetChannelsForCategoryResponse,
  ListContentAssetChannelsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { BC_CHANNEL_FILTER } from "../../auth/contentAuth";
import { ContentAuthService } from "../../auth/services/ContentAuthService";
import {
  GraphQlContentAssetChannel,
  GraphQlFullContentAssetChannel,
} from "../../types/content";
import {
  toDomainObject,
  toFullDomainObject,
} from "../converters/ContentAssetChannelConverter";

type GraphQlAssetCacheResponse = {
  dionysus_content_assets: {
    content_id: string;
    width: number;
    height: number;
  }[];
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlDeleteAssetCacheResponse = {
  delete_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
};

type ContentAssetCacheEntry = {
  channel_id?: string;
  assetId: string;
  width: number;
  height: number;
};

type ContentAssetCache = {
  entries: ContentAssetCacheEntry[];
  assetCount: number;
};

type GraphQlDescribeContentAssetChannelResponse = {
  dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel | null;
};

type GraphQlListContentAssetChannelResponse = {
  dionysus_content_asset_channel: GraphQlFullContentAssetChannel[];
  dionysus_content_asset_channel_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlListContentAssetChannelsForCategoryResponse = {
  dionysus_content_asset_channel_category_by_pk: {
    channels: GraphQlFullContentAssetChannel[];
    channels_aggregate: {
      aggregate: {
        count: number;
      };
    };
  } | null;
};

type GraphQlMutateContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_one: GraphQlFullContentAssetChannel;
};

type GraphQlUpdateContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel;
};

type GraphQlRefreshContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel;
};

type GraphQlFavoriteContentAssetChannelResponse = {
  update_dionysus_content_asset_channel_by_pk: GraphQlFullContentAssetChannel | null;
};

type GraphQlDeleteContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_cache: {
    affected_rows: number;
  };
  delete_dionysus_content_asset_channel_by_pk: GraphQlContentAssetChannel | null;
};

/**
 * Content asset channels in Hasura: saved asset filters with a cache of
 * their newest assets. Methods taking an `authToken` (the content auth
 * cookie) apply the channel curtain when it is missing or invalid.
 */
@Injectable()
export class ContentAssetChannelService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly contentAuth: ContentAuthService,
  ) {}

  /**
   * 404s for a missing channel, and for a channel that is not bcCompliant
   * when the request has no content auth.
   */
  async describe(
    channelId: string,
    authToken: string | undefined,
  ): Promise<FullContentAssetChannel> {
    const queryRequest = gql`
      query DescribeContentAssetChannel($channelId: uuid!) {
        dionysus_content_asset_channel_by_pk(id: $channelId) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeContentAssetChannelResponse>(
        queryRequest,
        {
          channelId: channelId,
        },
      );

    if (!queryResponse.dionysus_content_asset_channel_by_pk) {
      throw new NotFoundException();
    }

    if (
      !queryResponse.dionysus_content_asset_channel_by_pk.bcCompliant &&
      !(await this.contentAuth.authenticate(authToken, true))
    ) {
      throw new NotFoundException();
    }

    return toFullDomainObject(
      queryResponse.dionysus_content_asset_channel_by_pk,
    );
  }

  /** A page of channels matching `filter`, with the total match count. */
  async list(
    filter: FilterDefinition | undefined,
    pagination: PaginationParams,
    authToken: string | undefined,
  ): Promise<ListContentAssetChannelsResponse> {
    const whereExpression = buildFilterExpression(
      await this.contentAuth.applyCurtain(authToken, filter, BC_CHANNEL_FILTER),
    );
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListContentAssetChannels {
        dionysus_content_asset_channel(${[paginationExpression, whereExpression].join(", ")}) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
        dionysus_content_asset_channel_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetChannelResponse>(
        fetchRequest,
      );
    const fetched: FullContentAssetChannel[] = [];

    fetchResponse.dionysus_content_asset_channel.forEach((result) => {
      fetched.push(toFullDomainObject(result));
    });

    return {
      channels: fetched,
      count:
        fetchResponse.dionysus_content_asset_channel_aggregate.aggregate.count,
    };
  }

  /**
   * A page of a category's channels matching `filter`, with the total match
   * count. @throws NotFoundException
   */
  async listForCategory(
    categoryId: string,
    filter: FilterDefinition | undefined,
    pagination: PaginationParams,
    authToken: string | undefined,
  ): Promise<ListContentAssetChannelsForCategoryResponse> {
    const whereExpression = buildFilterExpression(
      await this.contentAuth.applyCurtain(authToken, filter, BC_CHANNEL_FILTER),
    );
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListContentAssetChannelsForCategory($categoryId: uuid!) {
        dionysus_content_asset_channel_category_by_pk(id: $categoryId) {
          channels(${[paginationExpression, whereExpression].join(", ")}) {
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
            assetCount
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate${whereExpression ? `(${whereExpression})` : ""} {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetChannelsForCategoryResponse>(
        fetchRequest,
        { categoryId: categoryId },
      );
    if (!fetchResponse.dionysus_content_asset_channel_category_by_pk) {
      throw new NotFoundException();
    }
    const category =
      fetchResponse.dionysus_content_asset_channel_category_by_pk;

    const fetched: ContentAssetChannel[] = [];

    category.channels.forEach((result) => {
      fetched.push(toDomainObject(result));
    });

    return {
      channels: fetched,
      count: category.channels_aggregate.aggregate.count,
    };
  }

  /** Creates a channel and fills its asset cache. */
  async create(
    channel: BaseContentAssetChannel,
  ): Promise<FullContentAssetChannel> {
    const assetCache = await this.buildAssetCacheEntries(
      channel.filterDefinition,
    );
    const insertRequest = gql`
      mutation CreateContentAssetChannel(
        $name: String!
        $description: String!
        $bcCompliant: Boolean!
        $categoryId: uuid!
        $filterInput: String!
        $encodedFilter: String!
        $ttl: numeric
        $jitter: numeric
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_one(
          object: {
            name: $name
            description: $description
            bcCompliant: $bcCompliant
            categoryId: $categoryId
            filterInput: $filterInput
            encodedFilter: $encodedFilter
            ttl: $ttl
            jitter: $jitter
            lastFetchedTime: $lastFetchedTime
            assetCount: $assetCount
            assetCache: { data: $assetCache }
          }
        ) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlMutateContentAssetChannelResponse>(
        insertRequest,
        {
          name: channel.name,
          description: channel.description,
          bcCompliant: channel.bcCompliant,
          categoryId: channel.categoryId,
          filterInput: channel.filterInput,
          encodedFilter: Buffer.from(
            JSON.stringify(channel.filterDefinition),
          ).toString("base64"),
          ttl: 7, // one week
          jitter: Math.floor(Math.random() * (24 * 60 - 4 * 60 + 1)) + 4 * 60,
          lastFetchedTime: moment.utc().toISOString(),
          assetCache: assetCache.entries,
          assetCount: assetCache.assetCount,
        },
      );

    return toFullDomainObject(
      insertResponse.insert_dionysus_content_asset_channel_one,
    );
  }

  /** Updates a channel and rebuilds its asset cache. @throws NotFoundException */
  async update(
    channelId: string,
    channel: BaseContentAssetChannel,
  ): Promise<FullContentAssetChannel> {
    // 404 before touching the cache of a channel that does not exist.
    await this.fetchChannelFilter(channelId);
    await this.clearContentAssetChannelCache(channelId);
    const assetCache = await this.buildAssetCacheEntries(
      channel.filterDefinition,
      channelId,
    );
    const updateRequest = gql`
      mutation UpdateContentAssetChannel(
        $channelId: uuid!
        $name: String!
        $description: String!
        $bcCompliant: Boolean!
        $filterInput: String!
        $encodedFilter: String!
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_cache(objects: $assetCache) {
          affected_rows
        }
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: {
            lastFetchedTime: $lastFetchedTime
            name: $name
            description: $description
            bcCompliant: $bcCompliant
            filterInput: $filterInput
            encodedFilter: $encodedFilter
            assetCount: $assetCount
          }
        ) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          name: channel.name,
          description: channel.description,
          bcCompliant: channel.bcCompliant,
          filterInput: channel.filterInput,
          encodedFilter: Buffer.from(
            JSON.stringify(channel.filterDefinition),
          ).toString("base64"),
          lastFetchedTime: moment.utc().toISOString(),
          assetCount: assetCache.assetCount,
          assetCache: assetCache.entries,
        },
      );

    return toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_by_pk,
    );
  }

  /** Rebuilds a channel's asset cache from its stored filter. @throws NotFoundException */
  async refresh(channelId: string): Promise<FullContentAssetChannel> {
    const encodedFilter = await this.fetchChannelFilter(channelId);

    const assetCache = await this.buildAssetCacheEntries(
      encodedFilter,
      channelId,
    );
    await this.clearContentAssetChannelCache(channelId);
    const updateRequest = gql`
      mutation UpdateContentAssetChannelCache(
        $channelId: uuid!
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_cache(objects: $assetCache) {
          affected_rows
        }
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: { lastFetchedTime: $lastFetchedTime, assetCount: $assetCount }
        ) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlRefreshContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          lastFetchedTime: moment.utc().toISOString(),
          assetCount: assetCache.assetCount,
          assetCache: assetCache.entries,
        },
      );

    return toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_by_pk,
    );
  }

  /** @throws NotFoundException */
  async setFavorite(
    channelId: string,
    favorite: boolean,
  ): Promise<FullContentAssetChannel> {
    const updateRequest = gql`
      mutation FavoriteContentAssetChannel(
        $channelId: uuid!
        $favorite: Boolean!
      ) {
        update_dionysus_content_asset_channel_by_pk(
          pk_columns: { id: $channelId }
          _set: { favorite: $favorite }
        ) {
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
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlFavoriteContentAssetChannelResponse>(
        updateRequest,
        {
          channelId: channelId,
          favorite: favorite,
        },
      );

    if (!updateResponse.update_dionysus_content_asset_channel_by_pk) {
      throw new NotFoundException();
    }

    return toFullDomainObject(
      updateResponse.update_dionysus_content_asset_channel_by_pk,
    );
  }

  /** Deletes a channel and its asset cache. @throws NotFoundException */
  async delete(channelId: string): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteContentAssetChannel($channelId: uuid!) {
        delete_dionysus_content_asset_channel_cache(
          where: { channel_id: { _eq: $channelId } }
        ) {
          affected_rows
        }
        delete_dionysus_content_asset_channel_by_pk(id: $channelId) {
          id
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteContentAssetChannelResponse>(
        deleteRequest,
        {
          channelId: channelId,
        },
      );

    if (!deleteResponse.delete_dionysus_content_asset_channel_by_pk) {
      throw new NotFoundException();
    }
  }

  private async buildAssetCacheEntries(
    channelFilter: FilterDefinition | string,
    channelId?: string,
  ): Promise<ContentAssetCache> {
    const whereExpression = buildFilterExpression(channelFilter);
    const paginationExpression = buildPaginationExpression({
      pageSize: 9,
      startPage: 0,
      sortDirection: SortDirection.DESC,
      sortField: "createdTime",
    });
    const assetCacheRequest = gql`
      query ListContentAssetChannelCandidates {
        dionysus_content_assets(${[paginationExpression, whereExpression].join(", ")}) {
          content_id
          width
          height
        }
        dionysus_content_assets_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }`;

    const assetCacheResponseResponse =
      await this.graphQLClient.request<GraphQlAssetCacheResponse>(
        assetCacheRequest,
      );

    const entries: ContentAssetCacheEntry[] =
      assetCacheResponseResponse.dionysus_content_assets.map((item) => {
        return {
          channel_id: channelId,
          assetId: item.content_id,
          width: item.width,
          height: item.height,
        };
      });

    return {
      entries: entries,
      assetCount:
        assetCacheResponseResponse.dionysus_content_assets_aggregate.aggregate
          .count,
    };
  }

  /** Returns the channel's stored (base64) filter, or 404s. */
  private async fetchChannelFilter(channelId: string): Promise<string> {
    const getFilterRequest = gql`
      query GetContentAssetChannelFilter($id: uuid!) {
        dionysus_content_asset_channel_by_pk(id: $id) {
          encodedFilter
        }
      }
    `;

    const getFilterResponse = await this.graphQLClient.request<{
      dionysus_content_asset_channel_by_pk: { encodedFilter: string } | null;
    }>(getFilterRequest, { id: channelId });

    if (!getFilterResponse.dionysus_content_asset_channel_by_pk) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    return getFilterResponse.dionysus_content_asset_channel_by_pk.encodedFilter;
  }

  private async clearContentAssetChannelCache(channelId: string) {
    const deleteCacheRequest = gql`
      mutation DeleteContentAssetChannelCache($channelId: uuid!) {
        delete_dionysus_content_asset_channel_cache(
          where: { channel_id: { _eq: $channelId } }
        ) {
          affected_rows
        }
      }
    `;

    await this.graphQLClient.request<GraphQlDeleteAssetCacheResponse>(
      deleteCacheRequest,
      {
        channelId: channelId,
      },
    );
  }
}
