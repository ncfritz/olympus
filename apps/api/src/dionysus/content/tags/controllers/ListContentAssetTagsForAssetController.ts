import { ListContentAssetTagsForAssetResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetTagService } from "../services/ContentAssetTagService";

@Controller({ version: "1" })
export class ListContentAssetTagsForAssetController {
  constructor(private readonly contentAssetTags: ContentAssetTagService) {}

  @Get("/content/asset/:assetId/tags")
  @ApiOperation({
    summary: "Lists the content asset tags for a content asset",
    description:
      "Lists the content asset tags associated with a content asset.",
    operationId: "ListContentAssetTagsForAsset",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to the tags for",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: ListContentAssetTagsForAssetResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListContentAssetTagsForAssetResponse = {
      tags: await this.contentAssetTags.listForAsset(assetId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
