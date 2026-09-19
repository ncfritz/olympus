import {
  publishMessage,
  START_DOWNLOAD_ROUTE,
} from "@ncfritz/olympus-messages";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BulkUpdateMediaAssetDownloadStatusRequest,
  DecoratedMediaAssetDownload,
  FilterDefinition,
  MediaAssetDownload,
  MediaAssetSearchType,
  MediaDownloadStatus,
  PartialMediaAssetDownload,
  SearchResultStatus,
  UpdateMediaAssetDownloadByNzbIdRequest,
} from "@ncfritz/olympus-model";
import { MediaAssetSearchResultService } from "../../searchResults/services/MediaAssetSearchResultService";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
  parseFilterDefinition,
} from "../../../../utils/filterUtil";
import {
  toDecoratedDomainObject,
  toDomainObject,
} from "../converters/MediaAssetDownloadConverter";
import {
  BASE_DECORATED_MEDIA_DOWNLOAD,
  BASE_MEDIA_DOWNLOAD,
} from "../queries/mediaDownload";
import { SEARCH_RESULT_KEY } from "../../searchResults/queries/searchResult";
import {
  GraphQlDecoratedMediaAssetDownload,
  GraphQlMediaAssetDownload,
} from "../types/mediaDownload";

type GraphQlCreateMediaAssetDownloadResponse = {
  insert_dionysus_media_asset_download_one: GraphQlMediaAssetDownload;
  update_dionysus_media_asset_search_result_by_pk: {
    status: string;
  };
};

type GraphQlListMediaAssetDownloadsResponse = {
  dionysus_media_asset_download: GraphQlDecoratedMediaAssetDownload[];
  dionysus_media_asset_download_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlLookupDownloadByNzbIdResponse = {
  dionysus_media_asset_download: {
    id: string;
    progress: number;
    status: MediaDownloadStatus;
    searchResult: {
      assetType: MediaAssetSearchType;
      mediaId: number;
      id: string;
    };
  }[];
};

type GraphQlUpdateMediaAssetDownloadByNzbIdResponse = {
  update_dionysus_media_asset_download_by_pk: GraphQlMediaAssetDownload;
  update_dionysus_media_asset_search_result_by_pk: {
    status: SearchResultStatus;
  };
};

type GraphQlUpdateChildMediaAssetDownloadResponse = {
  update_dionysus_media_asset_download_by_pk: GraphQlMediaAssetDownload | null;
};

/** A page of media downloads and the total number of matching downloads. */
export type MediaAssetDownloadPage = {
  downloads: DecoratedMediaAssetDownload[];
  count: number;
};

/** Dionysus media asset downloads in Hasura, and their start messages. */
@Injectable()
export class MediaAssetDownloadService {
  private readonly logger = new Logger(MediaAssetDownloadService.name);

  constructor(
    private readonly searchResults: MediaAssetSearchResultService,
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  /**
   * Creates a download for a search result, marks the result as requested and
   * publishes the (delayed) download start message.
   * @throws NotFoundException when the search result does not exist
   */
  async create(
    mediaType: MediaAssetSearchType,
    mediaId: number,
    resultId: string,
  ): Promise<MediaAssetDownload> {
    await this.searchResults.verifyExists(mediaType, mediaId, resultId);

    const insertRequest = gql`
      mutation CreateMediaAssetDownload(
        $status: String!
        $searchResultId: String!
        $progress: numeric!
        $assetType: String!
        $mediaId: numeric!
        $searchResultStatus: String!
      ) {
        insert_dionysus_media_asset_download_one(
          object: {
            status: $status
            searchResultId: $searchResultId
            progress: $progress
            assetType: $assetType
            mediaId: $mediaId
          }
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
        update_dionysus_media_asset_search_result_by_pk(pk_columns: {assetType: $assetType, id: $searchResultId, mediaId: $mediaId}, _set: {status: $searchResultStatus}) {
          status
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetDownloadResponse>(
        insertRequest,
        {
          status: MediaDownloadStatus.PENDING,
          progress: 0,
          searchResultId: resultId,
          assetType: mediaType,
          mediaId: mediaId,
          searchResultStatus: SearchResultStatus.DOWNLOAD_REQUESTED,
        },
      );

    const createdDownload: MediaAssetDownload = toDomainObject(
      insertResponse.insert_dionysus_media_asset_download_one,
    );

    await publishMessage(
      this.amqpConnection,
      START_DOWNLOAD_ROUTE,
      {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: resultId,
        downloadId: createdDownload.id,
        nzbId: resultId,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 10000,
        },
      },
    );

    return createdDownload;
  }

  /** Applies `changes` to a download of a search result. @throws NotFoundException */
  async update(
    resultId: string,
    downloadId: string,
    changes: PartialMediaAssetDownload,
  ): Promise<MediaAssetDownload> {
    const updateRequest = gql`
      mutation UpdateMediaAssetDownload(
        $downloadId: uuid!
        $searchResultId: String!
        $changes: dionysus_media_asset_download_set_input = {}
      ) {
        update_dionysus_media_asset_download_by_pk(
          pk_columns: { id: $downloadId, searchResultId: $searchResultId }
          _set: $changes
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetDownloadResponse>(
        updateRequest,
        {
          downloadId: downloadId,
          searchResultId: resultId,
          changes: changes,
        },
      );

    if (!updateResponse.update_dionysus_media_asset_download_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(
      updateResponse.update_dionysus_media_asset_download_by_pk,
    );
  }

  /**
   * Applies `request` to the download with an NZB ID, never lowering its
   * progress, and sets its search result's status. @throws NotFoundException
   */
  async updateByNzbId(
    nzbId: number,
    request: UpdateMediaAssetDownloadByNzbIdRequest,
  ): Promise<MediaAssetDownload> {
    const locateDownloadRequest = gql`
      query LookupDownloadByNzbId($nzbId: numeric!) {
        dionysus_media_asset_download(where: { nzbId: { _eq: $nzbId } }) {
          id
          progress
          status
          searchResult {
            ${SEARCH_RESULT_KEY}
          }
        }
      }
    `;

    const locateDownloadResponse =
      await this.graphQLClient.request<GraphQlLookupDownloadByNzbIdResponse>(
        locateDownloadRequest,
        { nzbId: nzbId },
      );

    if (locateDownloadResponse.dionysus_media_asset_download.length === 0) {
      throw new NotFoundException(`No download found for NZB ID ${nzbId}`);
    }

    if (
      request.download.progress &&
      request.download.progress <
        locateDownloadResponse.dionysus_media_asset_download[0].progress
    ) {
      this.logger.debug(
        `Download progress for NZB ID ${nzbId} is ${request.download.progress}, but download progress is ${locateDownloadResponse.dionysus_media_asset_download[0].progress}. Request progress will be ignored`,
      );

      request.download.progress =
        locateDownloadResponse.dionysus_media_asset_download[0].progress;
    }

    const downloadId = locateDownloadResponse.dionysus_media_asset_download[0];

    const updateRequest = gql`
      mutation UpdateMediaAssetDownloadByNzbId(
        $downloadId: uuid!
        $searchResultId: String!
        $assetType: String!
        $mediaId: numeric!
        $searchResultStatus: String!
        $changes: dionysus_media_asset_download_set_input = {}
      ) {
        update_dionysus_media_asset_download_by_pk(
          pk_columns: { id: $downloadId, searchResultId: $searchResultId }
          _set: $changes
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
        update_dionysus_media_asset_search_result_by_pk(
          pk_columns: {assetType: $assetType, id: $searchResultId, mediaId: $mediaId},
          _set: {status: $searchResultStatus}
        ) {
          status
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetDownloadByNzbIdResponse>(
        updateRequest,
        {
          downloadId: downloadId.id,
          searchResultId: downloadId.searchResult.id,
          assetType: downloadId.searchResult.assetType,
          mediaId: downloadId.searchResult.mediaId,
          searchResultStatus: request.searchResultStatus,
          changes: request.download,
        },
      );

    return toDomainObject(
      updateResponse.update_dionysus_media_asset_download_by_pk,
    );
  }

  /**
   * Applies progress/status updates to downloads by NZB ID in one mutation,
   * returning the updated downloads. Updates without an NZB ID are skipped.
   */
  async bulkUpdate(
    request: BulkUpdateMediaAssetDownloadStatusRequest,
  ): Promise<MediaAssetDownload[]> {
    // An update without an nzbId would match every download (Hasura v2
    // treats `_eq: null` as true), so those are skipped.
    const updates = request.updates.filter(
      (update) => update.nzbId !== undefined && update.nzbId !== null,
    );
    const appliedUpdates: MediaAssetDownload[] = [];

    if (updates.length > 0) {
      const variables: Record<string, unknown> = {};
      const declarations: string[] = [];
      const fields = updates.map((update, index) => {
        variables[`nzbId${index}`] = update.nzbId;
        variables[`progress${index}`] = update.progress;
        variables[`status${index}`] = update.status;
        declarations.push(
          `$nzbId${index}: numeric!, $progress${index}: numeric, $status${index}: String`,
        );
        return `update${index}: update_dionysus_media_asset_download(
          where: { nzbId: { _eq: $nzbId${index} } }
          _set: { progress: $progress${index}, status: $status${index} }
        ) {
          returning {
            ${BASE_MEDIA_DOWNLOAD}
          }
        }`;
      });

      const updateRequest = gql`
        mutation BulkUpdateMediaAssetDownloads(${declarations.join(", ")}) {
          ${fields.join("\n")}
        }
      `;

      const updateResponse = await this.graphQLClient.request<
        Record<string, { returning: GraphQlMediaAssetDownload[] }>
      >(updateRequest, variables);

      Object.values(updateResponse).forEach((update) => {
        update.returning.forEach((download) =>
          appliedUpdates.push(toDomainObject(download)),
        );
      });
    }

    return appliedUpdates;
  }

  /** A page of decorated downloads matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: FilterDefinition | string,
  ): Promise<MediaAssetDownloadPage> {
    const userFilters = parseFilterDefinition(filters);
    const whereExpression = buildFilterExpression(userFilters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListMediaAssetDownloads {
        dionysus_media_asset_download(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${BASE_DECORATED_MEDIA_DOWNLOAD}
        }
        dionysus_media_asset_download_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetDownloadsResponse>(
        fetchRequest,
      );
    const fetchedDownloads: DecoratedMediaAssetDownload[] = [];

    fetchResponse.dionysus_media_asset_download.forEach((configuration) => {
      fetchedDownloads.push(toDecoratedDomainObject(configuration));
    });

    return {
      downloads: fetchedDownloads,
      count:
        fetchResponse.dionysus_media_asset_download_aggregate.aggregate.count,
    };
  }
}
