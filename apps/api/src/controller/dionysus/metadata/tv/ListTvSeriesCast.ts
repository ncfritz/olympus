import {
  ListTvSeriesCastResponse,
  TVSeriesCastMember,
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
import { toTvSeriesCastMember } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { TV_SERIES_CAST_MEMBER } from "../../../../query/dionysus/metadata/tvSeries";
import { GraphQlTvSeriesCastMember } from "../../../../types/dionysus/metadata/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListTvSeriesCastResponse = {
  dionysus_tv_series_cast: GraphQlTvSeriesCastMember[];
};

@Controller({ version: "1" })
export class ListTvSeriesCastController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId/cast")
  @ApiOperation({
    summary: "Lists TV series cast members",
    description:
      "Lists the full cast for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesCastResponse,
    description: "The list of tvSeries cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListTvSeriesCastMembers($id: numeric!) {
        dionysus_tv_series_cast(
          order_by: { order: asc }
          where: { seriesId: { _eq: $id } }
        ) {
          ${TV_SERIES_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesCastResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    const cast: TVSeriesCastMember[] = [];

    fetchResponse.dionysus_tv_series_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvSeriesCastMember(result));
      }
    });

    const responseBody: ListTvSeriesCastResponse = {
      cast: cast,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
