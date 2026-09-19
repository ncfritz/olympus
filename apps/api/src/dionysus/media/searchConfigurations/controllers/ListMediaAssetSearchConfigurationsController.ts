import {
  ListMediaAssetSearchConfigurationsResponse,
  MediaAssetSearchConfigurationListItem,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObjectListItem } from "../converters/MediaAssetSearchConfigurationConverter";
import { BASE_SEARCH_CONFIGURATION_LIST_ITEM } from "../queries/searchConfiguration";
import { type GraphQlDecoratedMediaAssetSearchConfigurationListItem } from "../types/searchConfiguration";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
  parseFilterDefinition,
} from "../../../../utils/filterUtil";

export type GraphQlListMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration: GraphQlDecoratedMediaAssetSearchConfigurationListItem[];
  dionysus_media_asset_search_configuration_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMediaAssetSearchConfigurationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfigurations")
  @ApiOperation({
    summary: "Lists search configurations",
    description: "Lists search configurations.",
    operationId: "ListMediaAssetSearchConfigurations",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of search configurations.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchConfigurationsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "lastExecutionTime",
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

    const responseBody: ListMediaAssetSearchConfigurationsResponse = {
      searchConfigurations: fetchedConfigurations,
      count:
        fetchResponse.dionysus_media_asset_search_configuration_aggregate
          .aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
