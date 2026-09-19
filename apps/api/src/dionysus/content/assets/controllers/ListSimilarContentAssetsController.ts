import { ListSimilarContentAssetsResponse } from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class ListSimilarContentAssetsController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/asset/:assetId/similar")
  @ApiOperation({
    summary: "Lists similar content assets",
    description:
      "Lists content assets that are similar to this one based on the supplied set of tags.",
    operationId: "ListSimilarContentAssets",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to find similar assets for",
    type: String,
    required: true,
  })
  @ApiQuery({
    name: "tagType",
    explode: false,
    type: String,
    isArray: true,
  })
  @ApiQuery({
    name: "tagName",
    explode: false,
    type: String,
    isArray: true,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
  })
  @ApiOkResponse({
    description: "The list of similar assets capped at 25 items",
    type: () => ListSimilarContentAssetsResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Param("assetId") assetId: string,
    @Query("tagType") tagTypes: string,
    @Query("tagName") tagNames: string,
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    if (!tagNames || !tagTypes) {
      throw new BadRequestException("tagType and tagName are required");
    }

    const splitTagNames = tagNames.split(",");
    const splitTagTypes = tagTypes.split(",");

    if (splitTagNames.length <= 0 || splitTagTypes.length <= 0) {
      throw new BadRequestException("Invalid tag specification");
    }

    if (splitTagNames.length !== splitTagTypes.length) {
      throw new BadRequestException("Invalid tag specification");
    }

    const responseBody: ListSimilarContentAssetsResponse = {
      assets: await this.contentAssets.listSimilar(
        assetId,
        splitTagTypes,
        splitTagNames,
        curtain,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
