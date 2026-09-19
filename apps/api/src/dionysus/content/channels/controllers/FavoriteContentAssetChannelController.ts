import {
  FullContentAssetChannel,
  FavoriteContentAssetChannelRequest,
  FavoriteContentAssetChannelResponse,
  UpdateContentAssetChannelResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";

@Controller({ version: "1" })
export class FavoriteContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Put("/content/channel/:channelId/favorite")
  @ApiOperation({
    summary: "Marks a content asset channel as a favorite or not",
    description:
      "Marks a content asset channel as a favorite, or removes it from the favorites.",
    operationId: "FavoriteContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: FavoriteContentAssetChannelRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: FavoriteContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Body() request: FavoriteContentAssetChannelRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updatedCategory: FullContentAssetChannel =
      await this.contentAssetChannels.setFavorite(channelId, request.favorite);

    const responseBody: UpdateContentAssetChannelResponse = {
      channel: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
