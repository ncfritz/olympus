import {
  ContentAsset,
  ListContentAssetsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../../types/content";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";

type GraphQlListContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListContentAssetsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
  })
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
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    let blackCurtainClause = "";
    let blackCurtainAggregateClause = "";

    if (blackCurtain === "true") {
      blackCurtainClause =
        ', where: {asset_tags: {tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}}';
      blackCurtainAggregateClause =
        '(where: {asset_tags: {tag: {_and: {type: {_eq: "system"}, name: {_ilike: "bcCompliant"}}}}})';
    }

    const fetchRequest = gql`
      query ListContentAssets {
        dionysus_content_assets(limit: ${pageSize}, offset: ${
          pageSize * startPage
        }, order_by: {${sortField}: ${sortDirection}}${blackCurtainClause}) {
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
        dionysus_content_assets_aggregate${blackCurtainAggregateClause} {
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
