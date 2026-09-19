import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class GetContentAssetSizeStatisticsController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/assets/statistics/size")
  @ApiOperation({
    summary: "Gets size statistics",
    description: "Gets statistics on the content size.",
    operationId: "GetContentAssetSizeStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. These buckets come from database views over every asset and are not curtained.",
    required: false,
  })
  @ApiOkResponse({
    description: "Duration statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ContentStatisticsResponse =
      await this.contentAssets.getSizeStatistics();

    response.status(HttpStatus.OK).send(responseBody);
  }
}
