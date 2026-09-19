import { GetContentAssetWithStatsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";
import { contentAuthToken } from "../../auth/contentAuth";

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
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetContentAssetWithStatsResponse =
      await this.contentAssets.getUntagged(contentAuthToken(request));

    response.status(HttpStatus.OK).send(responseBody);
  }
}
