import {
  ContentAsset,
  FilterDefinition,
  FilterType,
  ListContentAssetsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../../types/content";
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
import {
  BaseAuthenticatedContentController,
  BC_FILTER,
} from "./auth/BaseAuthenticatedContentController";

type GraphQlListContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListContentAssetsController extends BaseAuthenticatedContentController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get("/content/assets")
  @ApiOperation({
    summary: "Lists content assets",
    description:
      "Lists content assets.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of assets fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentAssets",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
    required: false,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of assets.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Headers("x-dionysus-content-bc") blackCurtain: string = "true",
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const authenticated = this.authenticateRequest(request, true);
    const parsedFilters = parseFilterDefinition(filters);
    let queryFilters: FilterDefinition | undefined = parsedFilters;

    if (blackCurtain === "true" && !authenticated) {
      queryFilters = parsedFilters
        ? {
            type: FilterType.AND,
            name: "__base",
            value: [BC_FILTER, parsedFilters],
          }
        : parsedFilters;
    }

    const whereExpression = buildFilterExpression(queryFilters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
      fallbackSort: {
        sortField: "createdTime",
        sortDirection: SortDirection.DESC,
      },
    });

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

    const responseBody: ListContentAssetsResponse = {
      assets: fetchedAssets,
      count: fetchResponse.dionysus_content_assets_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
