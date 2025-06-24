import { GetContentAssetResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGerContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

@Controller()
export class GetContentAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/content/asset/:assetId")
  @ApiOperation({
    summary: "Get a single content asset",
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
  })
  @ApiOkResponse({
    description: "The content asset.",
    type: () => GetContentAssetResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    let blackCurtainClause = "";

    if (blackCurtain === "true") {
      blackCurtainClause =
        ', asset_tags: {tag: {_and: {name: {_ilike: "bccompliant"}, type: {_eq: "system"}}}}';
    }

    const fetchRequest = gql`
      query GetContentAssets($content_id: uuid) {
        dionysus_content_assets(
          where: { _and: { content_id: { _eq: $content_id }${blackCurtainClause} } }
        ) {
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
        {
          content_id: assetId,
        },
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
