import {
  CreateTVEpisodeRequest,
  CreateTVEpisodeResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeTvEpisodeController } from "./DescribeTvEpisodeController";
import { setLocation } from "../../../../utils/location";
import { TvEpisodeService } from "../services/TvEpisodeService";

@Controller({ version: "1" })
export class CreateTVSeriesEpisodeController {
  constructor(private readonly tvEpisodes: TvEpisodeService) {}

  @Put("/metadata/tvSeries/:seriesId/season/:seasonNumber/episodes")
  @ApiOperation({
    summary: "Upserts a TV series episode",
    description: "Creates or updates a TV series episode.",
    operationId: "CreateTVSeriesEpisode",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVEpisodeRequest,
    required: true,
    description: "Input for the CreateTVSeriesEpisode operation",
  })
  @ApiCreatedResponse({
    type: CreateTVEpisodeResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created TV episode",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("seriesId", ParseIntPipe) seriesId: number,
    @Param("seasonNumber", ParseIntPipe) seasonNumber: number,
    @Body() request: CreateTVEpisodeRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const episode = await this.tvEpisodes.create(
      seriesId,
      seasonNumber,
      request.episode,
    );

    const responseBody: CreateTVEpisodeResponse = {
      episodeId: episode.id,
      episodeNumber: episode.episodeNumber,
      seasonId: episode.seasonId,
      seasonNumber: episode.seasonNumber,
      seriesId: episode.seriesId,
    };

    setLocation(response, httpRequest, DescribeTvEpisodeController, {
      tvSeriesId: seriesId,
      seasonNumber,
      episodeNumber: request.episode.episodeNumber,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
