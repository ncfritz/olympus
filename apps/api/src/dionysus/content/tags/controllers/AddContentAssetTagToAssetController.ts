import {
  AddContentAssetTagToAssetRequest,
  EmptyResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetTagService } from "../services/ContentAssetTagService";

@Controller({ version: "1" })
export class AddContentAssetTagToAssetController {
  constructor(private readonly contentAssetTags: ContentAssetTagService) {}

  @Put("/content/asset/:assetId/tags")
  @ApiOperation({
    summary: "Adds a tag to a content asset",
    description:
      "Adds a tag to a content asset. If the tag does not exist, it is created before it is attached to the content asset.",
    operationId: "AddContentAssetTagToAsset",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to add the tag to",
    type: String,
  })
  @ApiBody({
    type: AddContentAssetTagToAssetRequest,
    required: true,
    description: "Input for the AddContentAssetTagToAsset operation",
  })
  @ApiOkResponse({
    description: "The tag has been successfully applied to the content asset.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The tag is already present on the content asset.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Body() request: AddContentAssetTagToAssetRequest,
    @Res() response: Response,
  ): Promise<void> {
    const status = (await this.contentAssetTags.addToAsset(
      assetId,
      request.tag,
    ))
      ? HttpStatus.OK
      : HttpStatus.NOT_MODIFIED;

    response.status(status).send({});
  }
}
