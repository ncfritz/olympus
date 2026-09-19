import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQLContentAssetBucketStatistic } from "../../../types/content";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlContentAssetWidthQueryResponse = {
  dionysus_content_asset_width_statistics: GraphQLContentAssetBucketStatistic[];
};

@Controller({ version: "1" })
export class GetContentAssetWidthStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/assets/statistics/width")
  @ApiOperation({
    summary: "Gets width statistics",
    description: "Gets statistics on the content widths.",
    operationId: "GetContentAssetWidthStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. These buckets come from database views over every asset and are not curtained.",
    required: false,
  })
  @ApiOkResponse({
    description: "Width statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetContentAssetWidthStatistics {
        dionysus_content_asset_width_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetWidthQueryResponse>(
        fetchRequest,
      );
    const categories: string[] = [];
    const data: number[] = [];

    fetchResponse.dionysus_content_asset_width_statistics.forEach((entry) => {
      categories.push(`${entry.bucket}px`);
      data.push(entry.count);
    });

    const responseBody: ContentStatisticsResponse = {
      categories: categories,
      series: [
        {
          name: "Width",
          data: data,
        },
      ],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
