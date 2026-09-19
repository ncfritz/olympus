import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { buildFilterExpression } from "../../../utils/filterUtil";
import { withContentCurtain } from "./auth/BaseAuthenticatedContentController";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlAssetAggregationStatsResponse = {
  dionysus_content_assets_aggregate: {
    aggregate: {
      count: number;
      avg: {
        asset_size: number;
        duration: number;
      };
      max: {
        duration: number;
        asset_size: number;
      };
      min: {
        duration: number;
        asset_size: number;
      };
      sum: {
        asset_size: number;
        duration: number;
      };
    };
  };
};

@Controller({ version: "1" })
export class GetContentAssetAggregateStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/assets/statistics/aggregate")
  @ApiOperation({
    summary: "Gets aggregated statistics",
    description:
      "Gets aggregated statistics on the content duration, size, and count.",
    operationId: "GetContentAssetAggregateStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
  })
  @ApiOkResponse({
    description: "Aggregate statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const whereExpression = buildFilterExpression(
      await withContentCurtain(this.graphQLClient, request, undefined),
    );

    const fetchRequest = gql`
      query GetContentAssetAggregateStatistics {
        dionysus_content_assets_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
            avg {
              asset_size
              duration
            }
            max {
              duration
              asset_size
            }
            min {
              duration
              asset_size
            }
            sum {
              asset_size
              duration
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlAssetAggregationStatsResponse>(
        fetchRequest,
      );
    const statistics =
      fetchResponse.dionysus_content_assets_aggregate.aggregate;

    response.status(HttpStatus.OK).send({
      count: statistics.count,
      minSize: statistics.min.asset_size,
      maxSize: statistics.max.asset_size,
      avgSize: statistics.avg.asset_size,
      totalSize: statistics.sum.asset_size,
      minDuration: statistics.min.duration,
      maxDuration: statistics.max.duration,
      avgDuration: statistics.avg.duration,
      totalDuration: statistics.sum.duration,
    });
  }
}
