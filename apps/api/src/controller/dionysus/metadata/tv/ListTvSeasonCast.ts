import {
  ListTvSeasonCastResponse,
  TVSeriesCastMember,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
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
import { toTvSeriesCastMember } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { TV_SERIES_CAST_MEMBER } from "../../../../query/dionysus/metadata/tvSeries";
import { GraphQlTvSeriesCastMember } from "../../../../types/dionysus/metadata/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseTVController } from "./BaseTVController";

type GraphQlListTvSeasonCastResponse = {
  dionysus_tv_season_cast: GraphQlTvSeriesCastMember[];
};

@Controller({ version: "1" })
export class ListTvSeasonCastController extends BaseTVController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/cast")
  @ApiOperation({
    summary: "Lists TV season cast members",
    description:
      "Lists the full cast for a TV season.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeasonCast",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeasonCastResponse,
    description: "The list of tvSeries cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,

    @Res() response: Response,
  ): Promise<void> {
    const seasonId = await this.lookupMediaIdForTvSeason(
      tvSeriesId,
      seasonNumber,
    );

    const fetchRequest = gql`
      query ListTvSeasonCast($id: numeric!) {
        dionysus_tv_season_cast(where: { seasonId: { _eq: $id } }) {
          ${TV_SERIES_CAST_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeasonCastResponse>(
        fetchRequest,
        { id: seasonId },
      );
    const cast: TVSeriesCastMember[] = [];

    fetchResponse.dionysus_tv_season_cast.forEach((result) => {
      if (result.person) {
        cast.push(toTvSeriesCastMember(result));
      }
    });

    const responseBody: ListTvSeasonCastResponse = {
      cast: cast,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
