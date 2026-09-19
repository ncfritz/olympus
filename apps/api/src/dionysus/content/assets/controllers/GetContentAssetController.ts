import { GetContentAssetResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Req, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";
import { contentAuthToken } from "../../auth/contentAuth";

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
  async handle(
    @Param("assetId") assetId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetContentAssetResponse = {
      asset: await this.contentAssets.describe(
        assetId,
        contentAuthToken(request),
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
