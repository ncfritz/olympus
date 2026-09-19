import { ListTVEpisodeCrewResponse } from "@ncfritz/olympus-model";
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvEpisodeService } from "../services/TvEpisodeService";

@Controller({ version: "1" })
export class ListTvEpisodeCrewController {
  constructor(private readonly tvEpisodes: TvEpisodeService) {}

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber/crew",
  )
  @ApiOperation({
    summary: "Lists TV episode crew members",
    description:
      "Lists the full crew for a TV episode.  This API is not paginated and does not support filtering.",
    operationId: "ListTvEpisodeCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series the episode is associated with",
    type: Number,
  })
  @ApiParam({
    name: "seasonNumber",
    description: "The season number the episode is part of",
    type: Number,
  })
  @ApiParam({
    name: "episodeNumber",
    description: "The episode number to describe",
    type: Number,
  })
  @ApiOkResponse({
    type: ListTVEpisodeCrewResponse,
    description: "The list of TV episode crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTVEpisodeCrewResponse = {
      crew: await this.tvEpisodes.listCrew(
        tvSeriesId,
        seasonNumber,
        episodeNumber,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
