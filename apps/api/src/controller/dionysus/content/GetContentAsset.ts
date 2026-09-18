import {
  FilterDefinition,
  FilterType,
  GetContentAssetResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../../types/content";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { buildFilterExpression } from "../../../utils/filterUtil";
import {
  BaseAuthenticatedContentController,
  BC_FILTER,
} from "./auth/BaseAuthenticatedContentController";

type GraphQlGerContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

@Controller({ version: "1" })
export class GetContentAssetController extends BaseAuthenticatedContentController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get("/content/asset/:assetId")
  @ApiOperation({
    summary: "Gets a single content asset",
    description: "Gets a single content asset by ID.",
    operationId: "GetContentAsset",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to get",
    type: String,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
    required: false,
  })
  @ApiOkResponse({
    description: "The content asset.",
    type: () => GetContentAssetResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Headers("x-dionysus-content-bc") blackCurtain: string = "true",
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const authenticated = await this.authenticateRequest(request, true);
    const itemFilter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "content_id",
      value: assetId,
    };

    const queryFilter: FilterDefinition =
      blackCurtain === "true" && !authenticated
        ? {
            type: FilterType.AND,
            name: "__and",
            value: [itemFilter, BC_FILTER],
          }
        : itemFilter;
    const whereExpression = buildFilterExpression(queryFilter);

    const fetchRequest = gql`
      query GetContentAsset {
        dionysus_content_assets(${whereExpression}) {
          content_id
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          original_sha
          original_size
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              createdTime
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGerContentAssetQueryResponse>(
        fetchRequest,
      );

    if (fetchResponse.dionysus_content_assets.length <= 0) {
      throw new NotFoundException(`Asset with ID ${assetId} not found`);
    }

    const responseBody: GetContentAssetResponse = {
      asset: toDomainObject(fetchResponse.dionysus_content_assets[0]),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
