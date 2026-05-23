import {
  BaseTVSeries,
  ListTvSeriesRecommendationsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseDomainObject as toTvSeriesDomainObject } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import { GraphQlTvSeriesRecommendation } from "../../../../types/dionysus/metadata/tvSeries";
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
    @Param("tvSeriesId") tvSeriesId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListTvSeriesRecommendations($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          recommendations {
            created_at
            updated_at
            tvSeries {
              adult
              backdropPath
              createdTime
              firstAirDate
              homepage
              id
              inProduction
              lastAirDate
              lastEpisodeToAirId
              lastUpdatedTime
              name
              numberOfEpisodes
              numberOfSeasons
              originalName
              original_language
              overview
              popularity
              posterPath
              status
              tagline
              type
              voteAverage
              voteCount
              ${SEARCH_CONFIGURATION}
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
    const recommendations: BaseTVSeries[] = [];

    fetchResponse.dionysus_tv_series_by_pk.recommendations.forEach((result) => {
      recommendations.push(toTvSeriesDomainObject(result.tvSeries));
    });

    const responseBody: ListTvSeriesRecommendationsResponse = {
      recommendations: recommendations,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
