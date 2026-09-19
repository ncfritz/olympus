import {
  BaseTVSeries,
  ListTvSeriesRecommendationsResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject as toTvSeriesDomainObject } from "../converters/tvSeriesConverter";
import { BASE_TV_SERIES } from "../queries/tvSeries";
import { GraphQlTvSeriesRecommendation } from "../types/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListTvSeriesRecommendationsResponse = {
  dionysus_tv_series_by_pk: {
    recommendations: GraphQlTvSeriesRecommendation[];
  };
};

@Controller({ version: "1" })
export class ListTvSeriesRecommendationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId/recommendations")
  @ApiOperation({
    summary: "Lists TV series recommendations",
    description:
      "Lists the recommendations for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesRecommendations",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesRecommendationsResponse,
    description: "The list of TV series recommendations.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListTvSeriesRecommendations($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          recommendations {
            tvSeries {
              ${BASE_TV_SERIES}
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesRecommendationsResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    if (!fetchResponse.dionysus_tv_series_by_pk) {
      throw new NotFoundException();
    }

    const recommendations: BaseTVSeries[] = [];

    fetchResponse.dionysus_tv_series_by_pk.recommendations.forEach((result) => {
      // Skip links to rows that are not in the database (yet).
      if (result.tvSeries) {
        recommendations.push(toTvSeriesDomainObject(result.tvSeries));
      }
    });

    const responseBody: ListTvSeriesRecommendationsResponse = {
      recommendations: recommendations,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
