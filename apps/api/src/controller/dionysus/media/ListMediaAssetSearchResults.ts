import {
  FilterDefinition,
  FilterType,
  ListMediaAssetSearchResultsResponse,
  MediaAssetSearchResult,
  MediaAssetSearchType,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchResultConverter";
import { BASE_SEARCH_RESULT } from "../../../query/dionysus/media/searchResult";
import { GraphQlMediaAssetSearchResult } from "../../../types/dionysus/media/searchResult";
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

export type GraphQlListMediaAssetSearchResultResponse = {
  dionysus_media_asset_search_result: GraphQlMediaAssetSearchResult[];
  dionysus_media_asset_search_result_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMediaAssetSearchResultsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/results")
  @ApiOperation({
    summary: "Lists search results for a search configuration",
    description:
      "Lists the search results for the specified search configuration.",
    operationId: "ListMediaAssetSearchResults",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type media asset the search configuration is for",
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
      "The list of search results.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchResultsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "postedTime",
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
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

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

    const responseBody: ListMediaAssetSearchResultsResponse = {
      searchResults: fetchedResults,
      count:
        fetchResponse.dionysus_media_asset_search_result_aggregate.aggregate
          .count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
