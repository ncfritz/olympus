import {
  ListTvSeasonCrewResponse,
  TVSeriesCrewMember,
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
import { toTvSeriesCrewMember } from "../converters/tvSeriesConverter";
import { TV_SERIES_CREW_MEMBER } from "../queries/tvSeries";
import { GraphQlTvSeriesCrewMember } from "../types/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseTVController } from "./BaseTVController";

type GraphQlListTvSeasonCrewResponse = {
  dionysus_tv_season_crew: GraphQlTvSeriesCrewMember[];
};

@Controller({ version: "1" })
export class ListTvSeasonCrewController extends BaseTVController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/crew")
  @ApiOperation({
    summary: "Lists TV season crew members",
    description:
      "Lists the full crew for a TV season.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeasonCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeasonCrewResponse,
    description: "The list of tvSeries crew members.",
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
      query ListTvSeasonCrew($id: numeric!) {
        dionysus_tv_season_crew(where: { seasonId: { _eq: $id } }) {
         ${TV_SERIES_CREW_MEMBER}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeasonCrewResponse>(
        fetchRequest,
        { id: seasonId },
      );
    const crew: TVSeriesCrewMember[] = [];

    fetchResponse.dionysus_tv_season_crew.forEach((result) => {
      if (result.person) {
        crew.push(toTvSeriesCrewMember(result));
      }
    });

    const responseBody: ListTvSeasonCrewResponse = {
      crew: crew,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
