import {
  CreateTVSeriesRequest,
  CreateTVSeriesResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeTvSeriesController } from "./DescribeTvSeriesController";
import { setLocation } from "../../../../utils/location";
import { TvSeriesService } from "../services/TvSeriesService";

@Controller({ version: "1" })
export class CreateTVSeriesController {
  constructor(private readonly tvSeries: TvSeriesService) {}

  @Put("/metadata/tvSeries")
  @ApiOperation({
    summary: "Upserts a TV series",
    description: "Creates or updates a TV series.",
    operationId: "CreateTVSeries",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTVSeriesRequest,
    required: true,
    description: "Input for the CreateTVSeries operation",
  })
  @ApiCreatedResponse({
    type: CreateTVSeriesResponse,
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
    @Body() request: CreateTVSeriesRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const seriesId = await this.tvSeries.create(request.tvSeries);

    const responseBody: CreateTVSeriesResponse = {
      seriesId: seriesId,
    };

    setLocation(response, httpRequest, DescribeTvSeriesController, {
      tvSeriesId: seriesId,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
