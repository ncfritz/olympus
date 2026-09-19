import { DescribeTVSeasonResponse, Season } from "@ncfritz/olympus-model";
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
import { toDomainObject } from "../converters/tvSeasonConverter";
import { TV_SEASON } from "../queries/tvSeries";
import { GraphQlTvSeason } from "../types/tvSeason";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeasonResponse = {
  dionysus_tv_seasons: GraphQlTvSeason[];
};

@Controller({ version: "1" })
export class DescribeTvSeasonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber")
  @ApiOperation({
    summary: "Describes a TV season in Dionysus",
    description: "Retrieves the details of a TV season in Dionysus.",
    operationId: "DescribeTvSeason",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series the season is associated with",
    type: Number,
  })
  @ApiParam({
    name: "seasonNumber",
    description: "The season number to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVSeasonResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeTvSeason($seriesId: numeric!, $seasonNumber: numeric!) {
        dionysus_tv_seasons(
          where: {
            _and: {
              seriesId: { _eq: $seriesId }
              seasonNumber: { _eq: $seasonNumber }
            }
          }
        ) {
          ${TV_SEASON}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeasonResponse>(
        fetchRequest,
        {
          seriesId: tvSeriesId,
          seasonNumber: seasonNumber,
        },
      );

    if (
      !fetchResponse.dionysus_tv_seasons ||
      fetchResponse.dionysus_tv_seasons.length <= 0
    ) {
      throw new NotFoundException();
    }

    const fetchedTvSeason: Season = toDomainObject(
      fetchResponse.dionysus_tv_seasons[0],
    );

    const responseBody: DescribeTVSeasonResponse = {
      season: fetchedTvSeason,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
