import { FilterDefinition, SortDirection } from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

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

export type ContentAssetCacheEntry = {
  channel_id?: string;
  assetId: string;
  width: number;
  height: number;
};

export type ContentAssetCache = {
  entries: ContentAssetCacheEntry[];
  assetCount: number;
};

export abstract class BaseContentAssetChannelController {
  protected constructor(protected readonly graphQLClient: GraphQLClient) {}

  protected async buildAssetCacheEntries(
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
      query ListContentAssets {
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

  protected async clearContentAssetChannelCache(channelId: string) {
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
