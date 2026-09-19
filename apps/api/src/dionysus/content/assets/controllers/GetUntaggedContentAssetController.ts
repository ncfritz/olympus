import { GetContentAssetWithStatsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth } from "../../auth/contentAuthDecorators";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class GetUntaggedContentAssetController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/assets/untagged")
  @ApiOperation({
    summary: "Gets a content asset that has no tags",
    description: "Gets a single content asset that has not been tagged yet.",
    operationId: "GetUntaggedContentAsset",
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
    description: "The content asset.",
    type: () => GetContentAssetWithStatsResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth({ required: true })
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetContentAssetWithStatsResponse =
      await this.contentAssets.getUntagged();

    response.status(HttpStatus.OK).send(responseBody);
  }
}
