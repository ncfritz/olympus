import {
  FilterDefinition,
  FilterType,
  ListMediaAssetSearchExecutionsResponse,
  MediaAssetSearchExecution,
  MediaAssetSearchType,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchExecutionConverter";
import { BASE_SEARCH_EXECUTION } from "../../../query/dionysus/media/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../../../types/dionysus/media/searchExecution";
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

export type GraphQlListMediaAssetSearchExecutionsResponse = {
  dionysus_media_asset_search_execution: GraphQlMediaAssetSearchExecution[];
  dionysus_media_asset_search_execution_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMediaAssetSearchExecutionsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/executions")
  @ApiOperation({
    summary: "Lists search executions for a search configuration",
    description:
      "Lists the search executions for the specified search configuration.  By default this API will nly return" +
      "the last 30 entries.",
    operationId: "ListMediaAssetSearchExecutions",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search configuration is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
  })
  @ApiParam({
    name: "mediaId",
    description:
      "The ID of the media that the search configuration is targeting.",
    type: Number,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of search executions.  If there are more executions to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchExecutionsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "startedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
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
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

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

    const responseBody: ListMediaAssetSearchExecutionsResponse = {
      searchExecutions: fetchedExecutions,
      count:
        fetchResponse.dionysus_media_asset_search_execution_aggregate.aggregate
          .count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
