import {
  FilterDefinition,
  FullContentAssetChannelCategory,
  ListContentAssetChannelCategoriesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Req, Res } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelCategoryConverter";
import { GraphQlFullContentAssetChannelCategory } from "../../../../types/content";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";
import {
  authenticateContentRequest,
  BC_CHANNEL_FILTER,
} from "../auth/BaseAuthenticatedContentController";

type GraphQlListContentAssetChannelCategoriesResponse = {
  dionysus_content_asset_channel_category: GraphQlFullContentAssetChannelCategory[];
  dionysus_content_asset_channel_category_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListContentAssetChannelCategoriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/channels/categories")
  @ApiOperation({
    summary: "Lists content asset channel categories",
    description:
      "Lists content asset channel categories.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of categories fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentAssetChannelCategories",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetChannelCategoriesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const channelWhere = (await authenticateContentRequest(
      this.graphQLClient,
      request,
      true,
    ))
      ? ""
      : (buildFilterExpression(BC_CHANNEL_FILTER) ?? "");

    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListContentAssetChannelCategories {
        dionysus_content_asset_channel_category(${[paginationExpression, whereExpression].join(", ")}) {
          channels${channelWhere ? `(${channelWhere})` : ""} {
            assetCache {
              createdTime
              assetId
              width
              height
            }
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
            categoryId
            bcCompliant
            assetCount
          }
          createdTime
          id
          lastUpdatedTime
          name
          channels_aggregate${channelWhere ? `(${channelWhere})` : ""} {
            aggregate {
              count
            }
          }
        }
        dionysus_content_asset_channel_category_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetChannelCategoriesResponse>(
        fetchRequest,
      );
    const fetchedCategories: FullContentAssetChannelCategory[] = [];

    fetchResponse.dionysus_content_asset_channel_category.forEach((result) => {
      fetchedCategories.push(toFullDomainObject(result));
    });

    const responseBody: ListContentAssetChannelCategoriesResponse = {
      categories: fetchedCategories,
      count:
        fetchResponse.dionysus_content_asset_channel_category_aggregate
          .aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
