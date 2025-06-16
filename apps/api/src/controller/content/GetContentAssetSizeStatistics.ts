import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, Headers, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import prettyBytes from "pretty-bytes";
import { GraphQLContentAssetBucketStatistic } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlContentAssetSizeQueryResponse = {
  dionysus_content_asset_size_statistics: GraphQLContentAssetBucketStatistic[];
};

@Controller()
export class GetContentAssetSizeStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/content/assets/statistics/size")
  @ApiOperation({
    summary: "Gets size statistics",
    description: "Gets statistics on the content size.",
    operationId: "GetContentAssetDurationStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description: "Header indicating black curtain status",
  })
  @ApiOkResponse({
    description: "Duration statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Headers("x-dionysus-content-bc") blackCurtain: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query GetContentAssetDurationStatistics {
        dionysus_content_asset_size_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetSizeQueryResponse>(
        fetchRequest,
      );
    const categories: string[] = [];
    const data: number[] = [];

    fetchResponse.dionysus_content_asset_size_statistics.forEach((entry) => {
      categories.push(
        `${prettyBytes(entry.bucket, { maximumFractionDigits: 1 })}`,
      );
      data.push(entry.count);
    });

    const responseBody: ContentStatisticsResponse = {
      categories: categories,
      series: [
        {
          name: "Size",
          data: data,
        },
      ],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
