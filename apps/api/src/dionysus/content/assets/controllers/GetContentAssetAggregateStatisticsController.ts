import { ContentStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class GetContentAssetAggregateStatisticsController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/assets/statistics/aggregate")
  @ApiOperation({
    summary: "Gets aggregated statistics",
    description:
      "Gets aggregated statistics on the content duration, size, and count.",
    operationId: "GetContentAssetAggregateStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
  })
  @ApiOkResponse({
    description: "Aggregate statistics.",
    type: () => ContentStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    response
      .status(HttpStatus.OK)
      .send(await this.contentAssets.getAggregateStatistics(curtain));
  }
}
