import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BaseMediaAssetSearchConfiguration,
  DecoratedMediaAssetSearchConfiguration,
  FilterDefinition,
  FilterType,
  MediaAssetSearchConfiguration,
  MediaAssetSearchConfigurationListItem,
  MediaAssetSearchConfigurationStatus,
  MediaAssetSearchType,
  PartialMediaAssetSearchConfiguration,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  toDecoratedDomainObject,
  toDomainObjectListItem,
} from "../converters/MediaAssetSearchConfigurationConverter";
import { BASE_MEDIA_ASSET } from "../../assets/queries/mediaAsset";
import { GraphQlMediaAsset } from "../../assets/types/mediaAsset";
import {
  BASE_DECORATED_SEARCH_CONFIGURATION,
  BASE_SEARCH_CONFIGURATION_LIST_ITEM,
} from "../queries/searchConfiguration";
import {
  GraphQlDecoratedMediaAssetSearchConfiguration,
  GraphQlDecoratedMediaAssetSearchConfigurationListItem,
} from "../types/searchConfiguration";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";

type GraphQlGetMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration_by_pk: GraphQlDecoratedMediaAssetSearchConfiguration;
};

type GraphQlVerifySearchConfigResponse = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
  } | null;
};

type GraphQlListMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration: GraphQlDecoratedMediaAssetSearchConfigurationListItem[];
  dionysus_media_asset_search_configuration_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type QueryRoot =
  | "dionysus_movies_by_pk"
  | "dionysus_tv_series_by_pk"
  | "dionysus_tv_seasons_by_pk"
  | "dionysus_tv_episodes_by_pk";

type GraphQlVerifyMediaResponse = {
  dionysus_movies_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_series_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_seasons_by_pk?: {
    id: string;
    asset?: GraphQlMediaAsset;
  };
  dionysus_tv_episodes_by_pk?: {
    id: string;
    asset: GraphQlMediaAsset;
  };
};

type GraphQlCreateMediaAssetSearchConfigurationResponse = {
  insert_dionysus_media_asset_search_configuration_one: GraphQlDecoratedMediaAssetSearchConfiguration;
};

type GraphQlUpdateMediaAssetSearchConfigurationResponse = {
  update_dionysus_media_asset_search_configuration_by_pk: GraphQlDecoratedMediaAssetSearchConfiguration | null;
};

type GraphQlUpdateChildMediaAssetSearchConfigurationsResponse = {
  update_dionysus_media_asset_search_configuration: {
    affected_rows: number;
  };
};

type GraphQlCountMediaAssetSearchConfigurationsResponse = {
  dionysus_media_asset_search_configuration_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** A page of search configurations plus the total matching count. */
export type MediaAssetSearchConfigurationList = {
  searchConfigurations: MediaAssetSearchConfigurationListItem[];
  count: number;
};

/** Media asset search configurations in Hasura, and search triggering. */
@Injectable()
export class MediaAssetSearchConfigurationService {
  private readonly logger = new Logger(
    MediaAssetSearchConfigurationService.name,
  );

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /** @throws NotFoundException */
  async describe(
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

  /** Checks that a search configuration exists. @throws NotFoundException */
  async verifyExists(
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

  async list(
    pagination: PaginationParams,
    userFilters: FilterDefinition | undefined,
  ): Promise<MediaAssetSearchConfigurationList> {
    const whereExpression = buildFilterExpression(userFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMediaAssetSearchConfigurations {
        dionysus_media_asset_search_configuration(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${BASE_SEARCH_CONFIGURATION_LIST_ITEM}
        }
        dionysus_media_asset_search_configuration_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetSearchConfigurationResponse>(
        fetchRequest,
      );
    const fetchedConfigurations: MediaAssetSearchConfigurationListItem[] = [];

    fetchResponse.dionysus_media_asset_search_configuration.forEach(
      (configuration) => {
        fetchedConfigurations.push(toDomainObjectListItem(configuration));
      },
    );

    return {
      searchConfigurations: fetchedConfigurations,
      count:
        fetchResponse.dionysus_media_asset_search_configuration_aggregate
          .aggregate.count,
    };
  }

  /**
   * Creates a search configuration for existing media; TV series and season
   * searches are triggered immediately. @throws BadRequestException
   */
  async create(
    searchConfiguration: BaseMediaAssetSearchConfiguration,
  ): Promise<DecoratedMediaAssetSearchConfiguration> {
    let graphQLQueryRoot: QueryRoot = "dionysus_movies_by_pk";

    if (searchConfiguration.type === MediaAssetSearchType.TV_SERIES) {
      graphQLQueryRoot = "dionysus_tv_series_by_pk";
    } else if (searchConfiguration.type === MediaAssetSearchType.TV_SEASON) {
      graphQLQueryRoot = "dionysus_tv_seasons_by_pk";
    } else if (searchConfiguration.type === MediaAssetSearchType.TV_EPISODE) {
      graphQLQueryRoot = "dionysus_tv_episodes_by_pk";
    }

    const verifyQuery = gql`
      query VerifyMedia($id: numeric!) {
        ${graphQLQueryRoot}(id: $id) {
          id
          ${
            searchConfiguration.type === MediaAssetSearchType.MOVIE ||
            searchConfiguration.type === MediaAssetSearchType.TV_EPISODE
              ? `asset {
            ${BASE_MEDIA_ASSET}
          }`
              : ""
          }
        }
      }
    `;

    const verifyResponse =
      await this.graphQLClient.request<GraphQlVerifyMediaResponse>(
        verifyQuery,
        {
          id: searchConfiguration.mediaId,
        },
      );

    if (!verifyResponse[graphQLQueryRoot]?.id) {
      throw new BadRequestException(
        "Source media definition could not be found",
      );
    }

    const assetExists = verifyResponse[graphQLQueryRoot]?.asset;

    const insertRequest = gql`
      mutation CreateMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
        $seriesId: numeric
        $seasonNumber: numeric
        $episodeNumber: numeric
        $backoff: numeric!
        $enabled: Boolean!
        $jitter: numeric!
        $status: String!
        $nextExecutionTime: timestamptz!
      ) {
        insert_dionysus_media_asset_search_configuration_one(
          object: {
            assetType: $assetType
            mediaId: $mediaId
            seriesId: $seriesId
            seasonNumber: $seasonNumber
            episodeNumber: $episodeNumber
            backoff: $backoff
            enabled: $enabled
            jitter: $jitter
            status: $status
            nextExecutionTime: $nextExecutionTime
          }
        ) {
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
        }
      }
    `;

    let nextExecutionTime = moment.utc();

    // Defer execution of the search for a movie or TV episode.  If the search is for a TV series or TV season
    // execute immediately in order to propagate the search status.
    if (
      searchConfiguration.type === MediaAssetSearchType.MOVIE ||
      searchConfiguration.type === MediaAssetSearchType.TV_EPISODE
    )
      nextExecutionTime = nextExecutionTime.add(
        Math.floor(Math.random() * searchConfiguration.jitter),
        "minutes",
      );

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchConfigurationResponse>(
        insertRequest,
        {
          assetType: searchConfiguration.type,
          mediaId: searchConfiguration.mediaId,
          seriesId: searchConfiguration.seriesId,
          seasonNumber: searchConfiguration.seasonNumber,
          episodeNumber: searchConfiguration.episodeNumber,
          backoff: searchConfiguration.backoff,
          enabled: assetExists ? false : searchConfiguration.enabled,
          jitter: searchConfiguration.jitter,
          status: searchConfiguration.status,
          nextExecutionTime: nextExecutionTime.toISOString(),
        },
      );

    const createdSearchConfiguration: DecoratedMediaAssetSearchConfiguration =
      toDecoratedDomainObject(
        insertResponse.insert_dionysus_media_asset_search_configuration_one,
      );

    if (
      createdSearchConfiguration.type === MediaAssetSearchType.TV_SERIES ||
      createdSearchConfiguration.type === MediaAssetSearchType.TV_SEASON
    ) {
      await this.amqpConnection.publish(
        "search.execution.trigger",
        `jobType.${createdSearchConfiguration.type}`,
        {
          mediaId: createdSearchConfiguration.mediaId,
        },
        {
          persistent: true,
          headers: {
            "x-delay": 0,
          },
        },
      );
    }

    return createdSearchConfiguration;
  }

  /**
   * Applies `changes` to a search configuration; with `recursive`, a change
   * to `enabled` cascades to child configurations. @throws NotFoundException
   */
  async update(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    searchConfiguration: PartialMediaAssetSearchConfiguration,
    recursive: boolean,
  ): Promise<DecoratedMediaAssetSearchConfiguration> {
    const updateRequest = gql`
      mutation UpdateMediaAssetSearchConfiguration(
        $mediaType: String!
        $mediaId: numeric!
        $changes: dionysus_media_asset_search_configuration_set_input = {}
      ) {
        update_dionysus_media_asset_search_configuration_by_pk(
          pk_columns: { assetType: $mediaType, mediaId: $mediaId }
          _set: $changes
        ) {
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
        }
      }
    `;

    const changes = { ...searchConfiguration };

    if (!searchConfiguration.nextExecutionTime) {
      changes.nextExecutionTime = moment
        .utc()
        .add(
          Math.floor(Math.random() * (searchConfiguration.jitter || 300)),
          "minutes",
        );
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchConfigurationResponse>(
        updateRequest,
        {
          mediaType: mediaType,
          mediaId: mediaId,
          changes: changes,
        },
      );

    if (
      !updateResponse.update_dionysus_media_asset_search_configuration_by_pk
    ) {
      throw new NotFoundException();
    }

    const updatedSearchConfiguration = toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_search_configuration_by_pk,
    );

    // If the update property set contains the "enabled" property and the media assetType is a TV season or TV series
    // cascade the enabled status to all child configurations
    if (
      Object.keys(searchConfiguration).includes("enabled") &&
      (updatedSearchConfiguration.type === MediaAssetSearchType.TV_SERIES ||
        updatedSearchConfiguration.type === MediaAssetSearchType.TV_SEASON) &&
      recursive
    ) {
      await this.enableChildSearchConfigurations(updatedSearchConfiguration);
    }

    return updatedSearchConfiguration;
  }

  /**
   * Schedules a search now and enqueues it; TV series and season searches
   * mark their child configurations as running. @throws NotFoundException
   */
  async trigger(
    mediaType: MediaAssetSearchType,
    mediaId: number,
  ): Promise<DecoratedMediaAssetSearchConfiguration> {
    const fetchedSearchConfiguration = await this.describe(mediaType, mediaId);

    const updateRequest = gql`
      mutation ScheduleMediaAssetSearch(
        $mediaType: String!
        $mediaId: numeric!
        $changes: dionysus_media_asset_search_configuration_set_input = {}
      ) {
        update_dionysus_media_asset_search_configuration_by_pk(
          pk_columns: { assetType: $mediaType, mediaId: $mediaId }
          _set: $changes
        ) {
          ${BASE_DECORATED_SEARCH_CONFIGURATION}
        }
      }
    `;

    const nextExecutionTime = moment
      .utc()
      .add(
        Math.floor(Math.random() * (fetchedSearchConfiguration.jitter || 300)),
        "minutes",
      );

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchConfigurationResponse>(
        updateRequest,
        {
          mediaType: mediaType,
          mediaId: mediaId,
          changes: {
            nextExecutionTime: nextExecutionTime.toISOString(),
          },
        },
      );

    const updatedSearchConfiguration = toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_search_configuration_by_pk!,
    );

    if (
      mediaType === MediaAssetSearchType.TV_SERIES ||
      mediaType === MediaAssetSearchType.TV_SEASON
    ) {
      await this.markChildSearchConfigurationsRunning(
        fetchedSearchConfiguration,
      );
    }

    const msg: Record<string, unknown> = {
      mediaId: updatedSearchConfiguration.mediaId,
      propagateImmediately: true,
      initiatingAsset: {
        assetType: mediaType,
        mediaId: mediaId,
      },
    };

    if (updatedSearchConfiguration.type === MediaAssetSearchType.TV_SEASON) {
      msg.initiatingAsset = {
        assetType: mediaType,
        mediaId: mediaId,
        seriesId: updatedSearchConfiguration.seriesId,
        seasonNumber: updatedSearchConfiguration.seasonNumber,
      };
    } else if (
      updatedSearchConfiguration.type === MediaAssetSearchType.TV_EPISODE
    ) {
      msg.initiatingAsset = {
        assetType: mediaType,
        mediaId: mediaId,
        seriesId: updatedSearchConfiguration.seriesId,
        seasonNumber: updatedSearchConfiguration.seasonNumber,
        episodeNumber: updatedSearchConfiguration.episodeNumber,
      };
    }

    await this.amqpConnection.publish(
      "search.execution.trigger",
      `jobType.${updatedSearchConfiguration.type}`,
      msg,
      {
        persistent: true,
        headers: {
          "x-delay": 0,
        },
      },
    );

    return updatedSearchConfiguration;
  }

  /**
   * The number of child search configurations of a TV series or season
   * that are marked as running. @throws BadRequestException
   */
  async getRunningCount(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    seasonNumber: number | undefined,
  ): Promise<number> {
    if (
      ![
        MediaAssetSearchType.TV_SERIES,
        MediaAssetSearchType.TV_SEASON,
      ].includes(mediaType)
    ) {
      throw new BadRequestException("mediatype must be tv_series or tv_season");
    }

    let targetTypes: MediaAssetSearchType[] = [];
    const filters: FilterDefinition[] = [
      {
        type: FilterType.EQUALS,
        name: "status",
        value: MediaAssetSearchConfigurationStatus.UPDATING,
      },
      {
        type: FilterType.EQUALS,
        name: "seriesId",
        value: mediaId,
      },
    ];

    if (mediaType === MediaAssetSearchType.TV_SERIES) {
      targetTypes = [
        MediaAssetSearchType.TV_SEASON,
        MediaAssetSearchType.TV_EPISODE,
      ];
    } else if (mediaType === MediaAssetSearchType.TV_SEASON) {
      if (!seasonNumber) {
        throw new BadRequestException("seasonNumber must be provided");
      }

      filters.push({
        type: FilterType.EQUALS,
        name: "seasonNumber",
        value: seasonNumber!,
      });
      targetTypes = [MediaAssetSearchType.TV_EPISODE];
    }

    const filter: FilterDefinition = {
      type: FilterType.AND,
      name: "_",
      value: [
        ...filters,
        {
          type: FilterType.IN,
          name: "assetType",
          value: targetTypes,
        },
      ],
    };

    const countRequest = gql`
      query GetMediaAssetSearchConfigurationsRunningCount {
        dionysus_media_asset_search_configuration_aggregate(${buildFilterExpression(filter)}) {
          aggregate {
            count
          }
        }
      }
    `;

    const countResponse =
      await this.graphQLClient.request<GraphQlCountMediaAssetSearchConfigurationsResponse>(
        countRequest,
      );

    return countResponse.dionysus_media_asset_search_configuration_aggregate
      .aggregate.count;
  }

  private async enableChildSearchConfigurations(
    configuration: MediaAssetSearchConfiguration,
  ) {
    this.logger.debug(
      `Updating child search configuration statuses to ${configuration.enabled}`,
    );

    let filter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "seriesId",
      value:
        configuration.type === MediaAssetSearchType.TV_SEASON
          ? configuration.seriesId!
          : configuration.mediaId,
    };

    if (configuration.type === MediaAssetSearchType.TV_SEASON) {
      filter = {
        type: FilterType.AND,
        name: "_",
        value: [
          filter,
          {
            type: FilterType.EQUALS,
            name: "seasonNumber",
            value: configuration.seasonNumber!,
          },
        ],
      };
    }

    const updateChildrenRequest = gql`
      mutation EnableChildSearchConfigurations(
        $enabled: Boolean
      ) {
        update_dionysus_media_asset_search_configuration(
          ${buildFilterExpression(filter)} 
          _set: { enabled: $enabled }
        ) {
          affected_rows
        }
      }
    `;

    const updateChildrenResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetSearchConfigurationsResponse>(
        updateChildrenRequest,
        { enabled: configuration.enabled },
      );

    this.logger.log(
      `Updated ${updateChildrenResponse.update_dionysus_media_asset_search_configuration.affected_rows} child search configurations`,
    );
  }

  private async markChildSearchConfigurationsRunning(
    searchConfiguration: MediaAssetSearchConfiguration,
  ) {
    const filters: FilterDefinition[] = [];
    let updateFilter: FilterDefinition | undefined = undefined;

    if (searchConfiguration.type === MediaAssetSearchType.TV_SERIES) {
      filters.push({
        type: FilterType.EQUALS,
        name: "seriesId",
        value: searchConfiguration.mediaId,
      });
    }

    if (searchConfiguration.type === MediaAssetSearchType.TV_SEASON) {
      filters.push({
        type: FilterType.EQUALS,
        name: "seriesId",
        value: searchConfiguration.seriesId!,
      });
      filters.push({
        type: FilterType.EQUALS,
        name: "seasonNumber",
        value: searchConfiguration.seasonNumber!,
      });
    }

    if (filters.length > 0) {
      updateFilter = {
        type: FilterType.AND,
        name: "_",
        value: filters,
      };
    }

    const updateChildrenRequest = gql`
      mutation MarkChildSearchConfigurationsRunning(
        $status: String!
      ) {
        update_dionysus_media_asset_search_configuration(
          ${buildFilterExpression(updateFilter)} 
          _set: { status: $status }
        ) {
          affected_rows
        }
      }
    `;

    const updateChildrenResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetSearchConfigurationsResponse>(
        updateChildrenRequest,
        { status: MediaAssetSearchConfigurationStatus.UPDATING },
      );

    this.logger.log(
      `Updated ${updateChildrenResponse.update_dionysus_media_asset_search_configuration.affected_rows} child search configurations`,
    );
  }
}
