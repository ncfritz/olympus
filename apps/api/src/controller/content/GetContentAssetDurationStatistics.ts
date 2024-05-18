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
import prettyMilliseconds from "pretty-ms";
import { GraphQLContentAssetBucketStatistic } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlContentAssetDurationQueryResponse = {
  dionysus_content_asset_duration_statistics: GraphQLContentAssetBucketStatistic[];
};

@Controller()
export class GetContentAssetDurationStatisticsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/assets/statistics/duration")
  @ApiOperation({
    summary: "Gets height statistics",
    description: "Gets statistics on the content duration.",
    operationId: "GetContentAssetDurationStatistics",
  })
  @ApiTags("Content")
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
        dionysus_content_asset_duration_statistics(order_by: { bucket: asc }) {
          bucket
          bucket_width
          count
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlContentAssetDurationQueryResponse>(
        fetchRequest,
      );
    const categories: string[] = [];
    const data: number[] = [];

    fetchResponse.dionysus_content_asset_duration_statistics.forEach(
      (entry) => {
        categories.push(`${prettyMilliseconds(entry.bucket * 60 * 1000)}`);
        data.push(entry.count);
      },
    );

    const responseBody: ContentStatisticsResponse = {
      categories: categories,
      series: [
        {
          name: "duration",
          data: data,
        },
      ],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
