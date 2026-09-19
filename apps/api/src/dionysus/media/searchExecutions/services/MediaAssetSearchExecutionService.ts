import {
  FilterDefinition,
  FilterType,
  MediaAssetSearchExecution,
  MediaAssetSearchType,
  PartialMediaAssetSearchExecution,
  SearchExecutionStatus,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetSearchExecutionConverter";
import { BASE_SEARCH_EXECUTION } from "../queries/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../types/searchExecution";
import { MediaAssetSearchConfigurationService } from "../../searchConfigurations/services/MediaAssetSearchConfigurationService";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";

type GraphQlCreateMediaAssetSearchExecutionResponse = {
  insert_dionysus_media_asset_search_execution_one: GraphQlMediaAssetSearchExecution;
};

type GraphQlGetMediaAssetSearchExecutionResponse = {
  dionysus_media_asset_search_execution_by_pk: GraphQlMediaAssetSearchExecution | null;
};

type GraphQlListMediaAssetSearchExecutionsResponse = {
  dionysus_media_asset_search_execution: GraphQlMediaAssetSearchExecution[];
  dionysus_media_asset_search_execution_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlUpdateMediaAssetSearchExecutionResponse = {
  update_dionysus_media_asset_search_execution_by_pk: GraphQlMediaAssetSearchExecution | null;
};

/** A page of search executions plus the total matching count. */
export type MediaAssetSearchExecutionList = {
  searchExecutions: MediaAssetSearchExecution[];
  count: number;
};

/** Executions of media asset search configurations in Hasura. */
@Injectable()
export class MediaAssetSearchExecutionService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  /** Starts a running execution of a search configuration. @throws NotFoundException */
  async create(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<MediaAssetSearchExecution> {
    await this.searchConfigurations.verifyExists(mediaType, mediaId);

    const insertRequest = gql`
      mutation CreateMediaAssetSearchExecution(
        $status: String!
        $searchType: String!
        $mediaId: numeric!
      ) {
        insert_dionysus_media_asset_search_execution_one(
          object: {
            status: $status
            searchType: $searchType
            mediaId: $mediaId
          }
        ) {
          ${BASE_SEARCH_EXECUTION}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchExecutionResponse>(
        insertRequest,
        {
          searchType: mediaType,
          mediaId: mediaId,
          status: SearchExecutionStatus.RUNNING,
        },
      );

    return toDomainObject(
      insertResponse.insert_dionysus_media_asset_search_execution_one,
    );
  }

  /**
   * An execution, addressed under its search configuration.
   * @throws NotFoundException
   */
  async describe(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    executionId: string,
  ): Promise<MediaAssetSearchExecution> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchExecution(
        $executionId: uuid!
      ) {
        dionysus_media_asset_search_execution_by_pk(
          id: $executionId
        ) {
          ${BASE_SEARCH_EXECUTION}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchExecutionResponse>(
        fetchRequest,
        { executionId: executionId },
      );

    const execution = fetchResponse.dionysus_media_asset_search_execution_by_pk;

    // Executions are addressed under their search configuration.
    if (
      !execution ||
      execution.searchType !== mediaType ||
      Number(execution.mediaId) !== mediaId
    ) {
      throw new NotFoundException();
    }

    return toDomainObject(execution);
  }

  /** Executions of a search configuration, narrowed by `userFilters`. */
  async list(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    pagination: PaginationParams,
    userFilters: FilterDefinition | undefined,
  ): Promise<MediaAssetSearchExecutionList> {
    const searchConfigurationFilter: FilterDefinition = {
      type: FilterType.AND,
      name: "_",
      value: [
        {
          type: FilterType.EQUALS,
          name: "searchType",
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
      query ListMediaAssetSearchExecutions {
        dionysus_media_asset_search_execution(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_SEARCH_EXECUTION}
        }
        dionysus_media_asset_search_execution_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetSearchExecutionsResponse>(
        fetchRequest,
      );
    const fetchedExecutions: MediaAssetSearchExecution[] = [];

    fetchResponse.dionysus_media_asset_search_execution.forEach((result) => {
      fetchedExecutions.push(toDomainObject(result));
    });

    return {
      searchExecutions: fetchedExecutions,
      count:
        fetchResponse.dionysus_media_asset_search_execution_aggregate.aggregate
          .count,
    };
  }

  /** Applies `changes` to an execution. @throws NotFoundException */
  async update(
    executionId: string,
    changes: PartialMediaAssetSearchExecution,
  ): Promise<MediaAssetSearchExecution> {
    const updateRequest = gql`
      mutation UpdateMediaAssetSearchExecution(
        $executionId: uuid!
        $changes: dionysus_media_asset_search_execution_set_input = {}
      ) {
        update_dionysus_media_asset_search_execution_by_pk(
          pk_columns: { id: $executionId }
          _set: $changes
        ) {
          ${BASE_SEARCH_EXECUTION}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchExecutionResponse>(
        updateRequest,
        {
          executionId: executionId,
          changes: changes,
        },
      );

    if (!updateResponse.update_dionysus_media_asset_search_execution_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      updateResponse.update_dionysus_media_asset_search_execution_by_pk,
    );
  }
}
