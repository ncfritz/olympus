import { DescribeTVEpisodeResponse } from "@ncfritz/olympus-model";
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
export class DescribeTvEpisodeController {
  constructor(private readonly tvEpisodes: TvEpisodeService) {}

  @Get(
    "/metadata/tvSeries/:tvSeriesId/seasons/:seasonNumber/episodes/:episodeNumber",
  )
  @ApiOperation({
    summary: "Describes a TV episode by series, season and episode number",
    description:
      "Retrieves the details of a TV episode identified by series, season number and episode number.",
    operationId: "DescribeTvEpisode",
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
    description: "The record has been successfully fetched.",
    type: DescribeTVEpisodeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Param("episodeNumber", ParseIntPipe) episodeNumber: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeTVEpisodeResponse = {
      episode: await this.tvEpisodes.describe(
        tvSeriesId,
        seasonNumber,
        episodeNumber,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
