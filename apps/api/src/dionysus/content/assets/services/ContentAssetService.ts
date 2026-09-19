import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BaseContentAsset,
  ContentAsset,
  ContentJobType,
  ContentStatisticsResponse,
  FilterDefinition,
  FilterType,
  GetContentAssetWithStatsResponse,
  ListContentAssetsResponse,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { ContentAuthService } from "../../auth/services/ContentAuthService";
import {
  GraphQLContentAsset,
  GraphQLContentAssetBucketStatistic,
} from "../../types/content";
import { toDomainObject } from "../converters/ContentAssetConverter";

type GraphQlGerContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

type GraphQlListContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlGetUntaggedContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  tagged: { aggregate: { count: number } };
  untagged: { aggregate: { count: number } };
};

type GraphQlListSimilarContentAssetsInput = {
  content_id: string;
};

type GraphQlListSimilarContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

type GraphQlListDuplicateContentAssetsInput = {
  sha: string;
};

type GraphQlListDuplicateContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

type GraphQLCreateContentAssetResponse = {
  insert_dionysus_content_assets_one: GraphQLContentAsset;
};

type GraphQlAssetAggregationStatsResponse = {
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
      avg: {
        asset_size: number;
        duration: number;
      };
      max: {
        duration: number;
        asset_size: number;
      };
      min: {
        duration: number;
        asset_size: number;
      };
      sum: {
        asset_size: number;
        duration: number;
      };
    };
  };
};

type GraphQlContentAssetSizeQueryResponse = {
  dionysus_content_asset_size_statistics: GraphQLContentAssetBucketStatistic[];
};

type GraphQlContentAssetDurationQueryResponse = {
  dionysus_content_asset_duration_statistics: GraphQLContentAssetBucketStatistic[];
};

type GraphQlContentAssetWidthQueryResponse = {
  dionysus_content_asset_width_statistics: GraphQLContentAssetBucketStatistic[];
};

type GraphQlContentAssetHeightQueryResponse = {
  dionysus_content_asset_height_statistics: GraphQLContentAssetBucketStatistic[];
};

/** Count, size and duration totals over the (curtained) content assets. */
export type ContentAssetAggregateStatistics = {
  count: number;
  minSize: number;
  maxSize: number;
  avgSize: number;
  totalSize: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  totalDuration: number;
};

/** A chart of bucket counts: one category per bucket, one named series. */
const toStatistics = (
  buckets: GraphQLContentAssetBucketStatistic[],
  name: string,
  label: (bucket: number) => string,
): ContentStatisticsResponse => {
  const categories: string[] = [];
  const data: number[] = [];

  buckets.forEach((entry) => {
    categories.push(label(entry.bucket));
    data.push(entry.count);
  });

  return {
    categories: categories,
    series: [
      {
        name: name,
        data: data,
      },
    ],
  };
};

/**
 * Content assets in Hasura. Methods taking an `authToken` (the content auth
 * cookie) apply the black curtain when it is missing or invalid.
 */
@Injectable()
export class ContentAssetService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
    private readonly contentAuth: ContentAuthService,
  ) {}

  /** @throws NotFoundException */
  async describe(
    assetId: string,
    authToken: string | undefined,
  ): Promise<ContentAsset> {
    const itemFilter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "content_id",
      value: assetId,
    };

    const whereExpression = buildFilterExpression(
      await this.contentAuth.applyCurtain(authToken, itemFilter),
    );

    const fetchRequest = gql`
      query GetContentAsset {
        dionysus_content_assets(${whereExpression}) {
          content_id
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          original_sha
          original_size
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              createdTime
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGerContentAssetQueryResponse>(
        fetchRequest,
      );

    if (fetchResponse.dionysus_content_assets.length <= 0) {
      throw new NotFoundException(`Asset with ID ${assetId} not found`);
    }

    return toDomainObject(fetchResponse.dionysus_content_assets[0]);
  }

  /** A page of assets matching `filter`, with the total match count. */
  async list(
    filter: FilterDefinition | undefined,
    pagination: PaginationParams,
    authToken: string | undefined,
  ): Promise<ListContentAssetsResponse> {
    const queryFilters = await this.contentAuth.applyCurtain(authToken, filter);

    const whereExpression = buildFilterExpression(queryFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListContentAssets {
        dionysus_content_assets(${[paginationExpression, whereExpression].join(", ")}) {
          content_id
          original_sha
          original_size
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              name
              type
            }
          }
        }
        dionysus_content_assets_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetsResponse>(
        fetchRequest,
      );
    const fetchedAssets: ContentAsset[] = [];

    fetchResponse.dionysus_content_assets.forEach((result) => {
      fetchedAssets.push(toDomainObject(result));
    });

    return {
      assets: fetchedAssets,
      count: fetchResponse.dionysus_content_assets_aggregate.aggregate.count,
    };
  }

  /**
   * An asset without (non-system) tags, with the tagged and untagged counts.
   * Tagging shows any asset, so it always requires content auth.
   * @throws UnauthorizedException, NotFoundException
   */
  async getUntagged(
    authToken: string | undefined,
  ): Promise<GetContentAssetWithStatsResponse> {
    await this.contentAuth.authenticate(authToken);

    const fetchRequest = gql`
      query GetUntaggedContentAsset {
        dionysus_content_assets(
          where: {
            _not: {
              asset_tags_aggregate: {
                count: {
                  predicate: { _gt: 0 }
                  filter: { tag: { type: { _nin: "system" } } }
                }
              }
            }
          }
          limit: 1
        ) {
          content_id
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          original_sha
          original_size
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              createdTime
              name
              type
            }
          }
        }
        untagged: dionysus_content_assets_aggregate(
          where: {
            _not: {
              asset_tags_aggregate: {
                count: {
                  predicate: { _gt: 0 }
                  filter: { tag: { type: { _nin: "system" } } }
                }
              }
            }
          }
        ) {
          aggregate {
            count
          }
        }
        tagged: dionysus_content_assets_aggregate(
          where: {
            asset_tags_aggregate: {
              count: {
                predicate: { _gte: 1 }
                filter: { tag: { type: { _nin: "system" } } }
              }
            }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetUntaggedContentAssetQueryResponse>(
        fetchRequest,
        {},
      );

    if (fetchResponse.dionysus_content_assets.length <= 0) {
      throw new NotFoundException(`No untagged content assets were found`);
    }

    return {
      asset: toDomainObject(fetchResponse.dionysus_content_assets[0]),
      tagged: fetchResponse.tagged.aggregate.count,
      untagged: fetchResponse.untagged.aggregate.count,
    };
  }

  /**
   * Up to 25 other assets sharing the most of the given tags
   * (`tagTypes[i]`/`tagNames[i]` pairs), most shared tags first.
   */
  async listSimilar(
    assetId: string,
    tagTypes: string[],
    tagNames: string[],
    authToken: string | undefined,
  ): Promise<ContentAsset[]> {
    const tagFilters: string[] = [];
    const aggregateTagFilters: string[] = [];
    let blackCurtainClause = "";
    let blackCurtainAggregateClause = "";

    for (let i = 0; i < tagTypes.length; i++) {
      tagFilters.push(
        `{ asset_tags: {tag: {_and: { name: { _ilike: ${JSON.stringify(tagNames[i])} }, type: { _eq: ${JSON.stringify(tagTypes[i])} } } } } }`,
      );
      aggregateTagFilters.push(
        `{ tag: {_and: { name: { _ilike: ${JSON.stringify(tagNames[i])} }, type: { _eq: ${JSON.stringify(tagTypes[i])} } } } }`,
      );
    }

    if (!(await this.contentAuth.authenticate(authToken, true))) {
      blackCurtainClause =
        '{ asset_tags: {tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}}';
      blackCurtainAggregateClause =
        '{ tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}';
    }

    const fetchRequest = gql`
      query ListSimilarContentAssets($content_id: uuid) {
        dionysus_content_assets(
          where: {
            _and: [
              { _not: { content_id: { _eq: $content_id } } }
              ${blackCurtainClause}
            ]
            _or: [
              ${tagFilters.join("\n")}
            ]
          }
          order_by: [{ asset_tags_aggregate: { count: desc } }]
          limit: 25
        ) {
          name
          rating
          original_name
          asset_tags_aggregate(
            where: {
              _and: [
                { _not: { content_id: { _eq: $content_id } } }
                ${blackCurtainAggregateClause}
              ]
              _or: [
                ${aggregateTagFilters.join("\n")}
              ]
            }
          ) {
            aggregate {
              count
            }
          }
          width
          original_size
          original_sha
          height
          duration
          createdTime
          content_id
          asset_tags {
            tag {
              content_tag_id
              createdTime
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse = await this.graphQLClient.request<
      GraphQlListSimilarContentAssetsResponse,
      GraphQlListSimilarContentAssetsInput
    >(fetchRequest, {
      content_id: assetId,
    });
    const fetchedAssets: ContentAsset[] = [];

    fetchResponse.dionysus_content_assets.forEach((result) => {
      fetchedAssets.push(toDomainObject(result));
    });

    return fetchedAssets;
  }

  /** Assets whose original or transcoded SHA256 sum is `digest`. */
  async listDuplicates(digest: string): Promise<ContentAsset[]> {
    const fetchRequest = gql`
      query ListDuplicateContentAssets($sha: String) {
        dionysus_content_assets(
          where: {
            _or: [{ asset_sha: { _eq: $sha } }, { original_sha: { _eq: $sha } }]
          }
        ) {
          content_id
          original_sha
          original_size
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse = await this.graphQLClient.request<
      GraphQlListDuplicateContentAssetsResponse,
      GraphQlListDuplicateContentAssetsInput
    >(fetchRequest, {
      sha: digest,
    });
    const fetchedAssets: ContentAsset[] = [];

    fetchResponse.dionysus_content_assets.forEach((result) => {
      fetchedAssets.push(toDomainObject(result));
    });

    return fetchedAssets;
  }

  async create(asset: BaseContentAsset): Promise<ContentAsset> {
    const insertRequest = gql`
      mutation CreateContentAsset(
        $asset_sha: String
        $asset_size: numeric
        $content_id: uuid
        $duration: numeric
        $height: numeric
        $original_name: String
        $original_sha: String
        $original_size: numeric
        $width: numeric
      ) {
        insert_dionysus_content_assets_one(
          object: {
            asset_sha: $asset_sha
            asset_size: $asset_size
            content_id: $content_id
            duration: $duration
            height: $height
            original_name: $original_name
            original_sha: $original_sha
            original_size: $original_size
            width: $width
          }
        ) {
          asset_sha
          asset_size
          content_id
          createdTime
          duration
          height
          name
          original_name
          original_sha
          original_size
          rating
          width
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQLCreateContentAssetResponse>(
        insertRequest,
        {
          asset_sha: asset.newSha,
          asset_size: asset.newSizeBytes,
          content_id: asset.id,
          duration: asset.durationMs,
          height: asset.height,
          original_name: asset.originalName,
          original_sha: asset.originalSha,
          original_size: asset.originalSizeBytes,
          width: asset.width,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_content_assets_one);
  }

  async setRating(assetId: string, rating: number): Promise<void> {
    const updateRequest = gql`
      mutation SetContentAssetRating($content_id: uuid!, $rating: numeric) {
        update_dionysus_content_assets_by_pk(
          pk_columns: { content_id: $content_id }
          _set: { rating: $rating }
        ) {
          rating
        }
      }
    `;

    await this.graphQLClient.request(updateRequest, {
      content_id: assetId,
      rating: rating,
    });
  }

  /** Publishes a processing job of `jobType` for an asset. */
  async createJob(assetId: string, jobType: ContentJobType): Promise<void> {
    await this.amqpConnection.publish("content.trigger", `jobType.${jobType}`, {
      assetId: assetId,
    });
  }

  async getAggregateStatistics(
    authToken: string | undefined,
  ): Promise<ContentAssetAggregateStatistics> {
    const whereExpression = buildFilterExpression(
      await this.contentAuth.applyCurtain(authToken, undefined),
    );

    const fetchRequest = gql`
      query GetContentAssetAggregateStatistics {
        dionysus_content_assets_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
            avg {
              asset_size
              duration
            }
            max {
              duration
              asset_size
            }
            min {
              duration
              asset_size
            }
            sum {
              asset_size
              duration
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlAssetAggregationStatsResponse>(
        fetchRequest,
      );
    const statistics =
      fetchResponse.dionysus_content_assets_aggregate.aggregate;

    return {
      count: statistics.count,
      minSize: statistics.min.asset_size,
      maxSize: statistics.max.asset_size,
      avgSize: statistics.avg.asset_size,
      totalSize: statistics.sum.asset_size,
      minDuration: statistics.min.duration,
      maxDuration: statistics.max.duration,
      avgDuration: statistics.avg.duration,
      totalDuration: statistics.sum.duration,
    };
  }

  async getSizeStatistics(): Promise<ContentStatisticsResponse> {
    const fetchRequest = gql`
      query GetContentAssetSizeStatistics {
        dionysus_content_asset_size_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetSizeQueryResponse>(
        fetchRequest,
      );

    return toStatistics(
      fetchResponse.dionysus_content_asset_size_statistics,
      "Size",
      (bucket) => `${prettyBytes(bucket, { maximumFractionDigits: 1 })}`,
    );
  }

  async getDurationStatistics(): Promise<ContentStatisticsResponse> {
    const fetchRequest = gql`
      query GetContentAssetDurationStatistics {
        dionysus_content_asset_duration_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetDurationQueryResponse>(
        fetchRequest,
      );

    return toStatistics(
      fetchResponse.dionysus_content_asset_duration_statistics,
      "duration",
      (bucket) => `${prettyMilliseconds(bucket * 60 * 1000)}`,
    );
  }

  async getWidthStatistics(): Promise<ContentStatisticsResponse> {
    const fetchRequest = gql`
      query GetContentAssetWidthStatistics {
        dionysus_content_asset_width_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetWidthQueryResponse>(
        fetchRequest,
      );

    return toStatistics(
      fetchResponse.dionysus_content_asset_width_statistics,
      "Width",
      (bucket) => `${bucket}px`,
    );
  }

  async getHeightStatistics(): Promise<ContentStatisticsResponse> {
    const fetchRequest = gql`
      query GetContentAssetHeightStatistics {
        dionysus_content_asset_height_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetHeightQueryResponse>(
        fetchRequest,
      );

    return toStatistics(
      fetchResponse.dionysus_content_asset_height_statistics,
      "Height",
      (bucket) => `${bucket}px`,
    );
  }
}
