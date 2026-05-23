import {
  ListTvSeriesCrewResponse,
  TVSeriesCrewMember,
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
import { toTvSeriesCrewMember } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { GraphQlTvSeriesCrewMember } from "../../../../types/dionysus/metadata/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListTvSeriesCrewResponse = {
  dionysus_tv_series_crew: GraphQlTvSeriesCrewMember[];
};

@Controller({ version: "1" })
export class ListTvSeriesCrewController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId/crew")
  @ApiOperation({
    summary: "Lists TV series crew members",
    description:
      "Lists the full crew for a TV series.  This API is not paginated and does not support filtering.",
    operationId: "ListTvSeriesCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListTvSeriesCrewResponse,
    description: "The list of tvSeries crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId") tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListTvSeriesCrewMembers($id: numeric!) {
        dionysus_tv_series_crew(where: { seriesId: { _eq: $id } }) {
          createdTime
          lastUpdatedTime
          department
          originalName
          totalEpisodeCount
          jobs {
            job
            createdTime
            creditId
            episodeCount
            lastUpdatedTime
          }
          person {
            adult
            birthday
            birthplace
            createdTime
            deathday
            gender
            homepage
            id
            imdbId
            knownForDepartment
            lastUpdatedTime
            name
            profilePath
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListTvSeriesCrewResponse>(
        fetchRequest,
        { id: tvSeriesId },
      );
    const crew: TVSeriesCrewMember[] = [];

    fetchResponse.dionysus_tv_series_crew.forEach((result) => {
      if (result.person) {
        crew.push(toTvSeriesCrewMember(result));
      }
    });

    const responseBody: ListTvSeriesCrewResponse = {
      crew: crew,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
