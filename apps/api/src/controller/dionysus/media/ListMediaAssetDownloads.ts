import {
  DecoratedMediaAssetDownload,
  ListMediaAssetDownloadsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetDownloadConverter";
import { BASE_DECORATED_MEDIA_DOWNLOAD } from "../../../query/dionysus/media/mediaDownload";
import { GraphQlDecoratedMediaAssetDownload } from "../../../types/dionysus/media/mediaDownload";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
  parseFilterDefinition,
} from "../../../utils/filterUtil";

export type GraphQlListMediaAssetDownloadsResponse = {
  dionysus_media_asset_download: GraphQlDecoratedMediaAssetDownload[];
  dionysus_media_asset_download_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMediaAssetDownloadsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/downloads")
  @ApiOperation({
    summary: "Lists media downloads",
    description: "Lists media downloads.",
    operationId: "ListMediaAssetDownloads",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of downloads.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetDownloadsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "startedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const whereExpression = buildFilterExpression(userFilters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

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

    const responseBody: ListMediaAssetDownloadsResponse = {
      downloads: fetchedDownloads,
      count:
        fetchResponse.dionysus_media_asset_download_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
