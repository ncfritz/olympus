import {
  ContentAssetChannel,
  FilterDefinition,
  ListContentAssetChannelsForCategoryResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

type GraphQlListContentAssetChannelsForCategoryResponse = {
  dionysus_content_asset_channel_category_by_pk: {
    channels: GraphQlFullContentAssetChannel[];
    channels_aggregate: {
      aggregate: {
        count: number;
      };
    };
  } | null;
};

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListContentAssetChannelsForCategoryController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/channels/category/:categoryId/channels")
  @ApiOperation({
    summary: "Lists the content asset channels in a category",
    description: "Lists the content asset channels in a channel category.",
    operationId: "ListContentAssetChannelsForCategory",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "categoryId",
    description: "The ID of the channel category to describe",
    type: String,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetChannelsForCategoryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("categoryId") categoryId: string,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListContentAssetChannelsForCategory($categoryId: uuid!) {
        dionysus_content_asset_channel_category_by_pk(id: $categoryId) {
          channels(${[paginationExpression, whereExpression].join(", ")}) {
            bcCompliant
            categoryId
            createdTime
            description
            encodedFilter
            favorite
            filterInput
            id
            jitter
            lastFetchedTime
            lastUpdatedTime
            name
            ttl
            assetCount
            assetCache {
              assetId
              createdTime
            }
          }
          channels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListContentAssetChannelsForCategoryResponse>(
        fetchRequest,
        { categoryId: categoryId },
      );
    if (!fetchResponse.dionysus_content_asset_channel_category_by_pk) {
      throw new NotFoundException();
    }
    const category =
      fetchResponse.dionysus_content_asset_channel_category_by_pk;

    const fetched: ContentAssetChannel[] = [];

    category.channels.forEach((result) => {
      fetched.push(toDomainObject(result));
    });

    const responseBody: ListContentAssetChannelsForCategoryResponse = {
      channels: fetched,
      count: category.channels_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
