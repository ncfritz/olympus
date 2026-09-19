import { ListTVEpisodeCastResponse } from "@ncfritz/olympus-model";
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
export class ListTvEpisodeCastController {
  constructor(private readonly tvEpisodes: TvEpisodeService) {}

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber/cast",
  )
  @ApiOperation({
    summary: "Lists TV episode cast members",
    description:
      "Lists the full cast for a TV episode.  This API is not paginated and does not support filtering.",
    operationId: "ListTvEpisodeCast",
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
    type: ListTVEpisodeCastResponse,
    description: "The list of TV episode cast members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListTVEpisodeCastResponse = {
      cast: await this.tvEpisodes.listCast(
        tvSeriesId,
        seasonNumber,
        episodeNumber,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
