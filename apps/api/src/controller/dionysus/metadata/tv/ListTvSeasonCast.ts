import {
  ListTvSeasonCastResponse,
  TVSeriesCastMember,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toTvSeriesCastMember } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { GraphQlTvSeriesCastMember } from "../../../../types/dionysus/metadata/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlTvSeasonIdLookupResponse = {
  dionysus_tv_seasons: {
    id: number;
  }[];
};

type GraphQlListTvSeasonCastResponse = {
  dionysus_tv_season_cast: GraphQlTvSeriesCastMember[];
};

@Controller({ version: "1" })
export class ListTvSeasonCastController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    @Param("tvSeriesId") tvSeriesId: number,
    @Param("seasonNumber") seasonNumber: number,

    @Res() response: Response,
  ): Promise<void> {
    const seasonIdLookupRequest = gql`
      query LookupTvSeasonId($seriesId: numeric!, $seasonNumber: numeric!) {
        dionysus_tv_seasons(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
            }
          }
        ) {
          id
        }
      }
    `;

    const tvSeriesIdFetchResponse =
      await this.graphQLClient.request<GraphQlTvSeasonIdLookupResponse>(
        seasonIdLookupRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
        },
      );

    if (tvSeriesIdFetchResponse.dionysus_tv_seasons.length <= 0) {
      throw new NotFoundException();
    }

    const seasonId = tvSeriesIdFetchResponse.dionysus_tv_seasons[0].id;

    const fetchRequest = gql`
      query ListTvSeasonCastMembers($id: numeric!) {
        dionysus_tv_season_cast(where: { seasonId: { _eq: $id } }) {
          createdTime
          lastUpdatedTime
          order
          originalName
          totalEpisodeCount
          roles {
            character
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
