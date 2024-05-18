import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { GetContentAssetWithStatsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, Headers, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGerContentAssetQueryResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
  tagged: { aggregate: { count: number } };
  untagged: { aggregate: { count: number } };
};

@Controller()
export class GetUntaggedContentAssetController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/assets/untagged")
  @ApiOperation({
    summary: "Get a single content asset",
    description: "Gets a single content asset by ID.",
    operationId: "GetUntaggedContentAsset",
  })
  @ApiTags("Content")
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
  })
  @ApiOkResponse({
    description: "The content asset.",
    type: () => GetContentAssetWithStatsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    if (blackCurtain === "true") {
      response.status(HttpStatus.UNAUTHORIZED).end();
      return;
    }

    const fetchRequest = gql`
      query GetContentAssets($content_id: uuid) {
        dionysus_content_assets(
          where: {
            _not: { asset_tags_aggregate: { count: { predicate: { _gt: 1 } } } }
          }
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
                count: { predicate: { _gt: 1 }, filter: {} }
              }
            }
          }
        ) {
          aggregate {
            count
          }
        }
        tagged: dionysus_content_assets_aggregate(
          where: { asset_tags_aggregate: { count: { predicate: { _gte: 1 } } } }
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
      response.status(404).end();
      return;
    }

    const responseBody: GetContentAssetWithStatsResponse = {
      asset: toDomainObject(fetchResponse.dionysus_content_assets[0]),
      tagged: fetchResponse.tagged.aggregate.count,
      untagged: fetchResponse.untagged.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
