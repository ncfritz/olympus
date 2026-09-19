import { GetContentAssetResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class GetContentAssetController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/asset/:assetId")
  @ApiOperation({
    summary: "Gets a single content asset",
    description: "Gets a single content asset by ID.",
    operationId: "GetContentAsset",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to get",
    type: String,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
  })
  @ApiOkResponse({
    description: "The content asset.",
    type: () => GetContentAssetResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Param("assetId") assetId: string,
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetContentAssetResponse = {
      asset: await this.contentAssets.describe(assetId, curtain),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
