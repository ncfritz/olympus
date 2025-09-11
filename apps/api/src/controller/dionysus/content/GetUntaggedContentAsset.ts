import { GetContentAssetWithStatsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../../types/content";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGerContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  tagged: { aggregate: { count: number } };
  untagged: { aggregate: { count: number } };
};

@Controller({ version: "1" })
export class GetUntaggedContentAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/assets/untagged")
  @ApiOperation({
    summary: "Get a single content asset",
    description: "Gets a single content asset by ID.",
    operationId: "GetUntaggedContentAsset",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
    required: false,
  })
  @ApiOkResponse({
    description: "The content asset.",
    type: () => GetContentAssetWithStatsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Headers("x-dionysus-content-bc") blackCurtain: string = "true",
    @Res() response: Response,
  ): Promise<void> {
    if (blackCurtain === "true") {
      throw new UnauthorizedException();
    }

    const fetchRequest = gql`
      query GetContentAssets {
        dionysus_content_assets(
          where: {
            _not: {
              asset_tags_aggregate: {
                count: {
                  predicate: { _gt: 1 }
                  filter: { tag: { type: { _nin: "system" } } }
                }
              }
            }
          }
          limit: 1
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
        untagged: dionysus_content_assets_aggregate(
          where: {
            _not: {
              asset_tags_aggregate: {
                count: {
                  predicate: { _gt: 1 }
                  filter: { tag: { type: { _nin: "system" } } }
                }
              }
            }
          }
        ) {
          aggregate {
            count
          }
        }
        tagged: dionysus_content_assets_aggregate(
          where: {
            asset_tags_aggregate: {
              count: {
                predicate: { _gte: 1 }
                filter: { tag: { type: { _nin: "system" } } }
              }
            }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGerContentAssetQueryResponse>(
        fetchRequest,
        {},
      );

    if (fetchResponse.dionysus_content_assets.length <= 0) {
      throw new NotFoundException(`No untagged content assets were found`);
    }

    const responseBody: GetContentAssetWithStatsResponse = {
      asset: toDomainObject(fetchResponse.dionysus_content_assets[0]),
      tagged: fetchResponse.tagged.aggregate.count,
      untagged: fetchResponse.untagged.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
