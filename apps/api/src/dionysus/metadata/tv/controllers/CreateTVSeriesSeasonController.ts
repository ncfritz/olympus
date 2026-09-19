import {
  CreateTVSeasonRequest,
  CreateTVSeasonResponse,
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
import { DescribeTvSeasonController } from "./DescribeTvSeasonController";
import { setLocation } from "../../../../utils/location";
import { TvSeasonService } from "../services/TvSeasonService";

@Controller({ version: "1" })
export class CreateTVSeriesSeasonController {
  constructor(private readonly tvSeasons: TvSeasonService) {}

  @Put("/metadata/tvSeries/:seriesId/seasons")
  @ApiOperation({
    summary: "Upserts a TV series season",
    description: "Creates or updates a TV series season.",
    operationId: "CreateTVSeriesSeason",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVSeasonRequest,
    required: true,
    description: "Input for the CreateTVSeriesSeason operation",
  })
  @ApiCreatedResponse({
    type: CreateTVSeasonResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created TV series",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("seriesId", ParseIntPipe) seriesId: number,
    @Body() request: CreateTVSeasonRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const season = await this.tvSeasons.create(seriesId, request.season);

    const responseBody: CreateTVSeasonResponse = {
      seasonId: season.id,
      seasonNumber: season.seasonNumber,
      seriesId: season.seriesId,
    };

    setLocation(response, httpRequest, DescribeTvSeasonController, {
      tvSeriesId: seriesId,
      seasonNumber: request.season.seasonNumber,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
