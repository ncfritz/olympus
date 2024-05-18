import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
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
import { GraphQLContentAssetBucketStatistic } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlContentAssetHeightQueryResponse = {
  dionysus_content_asset_height_statistics: GraphQLContentAssetBucketStatistic[];
};

@Controller()
export class GetContentAssetHeightStatisticsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/assets/statistics/height")
  @ApiOperation({
    summary: "Gets height statistics",
    description: "Gets statistics on the content heights.",
    operationId: "GetContentAssetHeightStatistics",
  })
  @ApiTags("Content")
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
  })
  @ApiOkResponse({
    description: "Height statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query GetContentAssetHeightStatistics {
        dionysus_content_asset_height_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetHeightQueryResponse>(
        fetchRequest,
      );
    const categories: string[] = [];
    const data: number[] = [];

    fetchResponse.dionysus_content_asset_height_statistics.forEach((entry) => {
      categories.push(`${entry.bucket}px`);
      data.push(entry.count);
    });

    const responseBody: ContentStatisticsResponse = {
      categories: categories,
      series: [
        {
          name: "Height",
          data: data,
        },
      ],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
