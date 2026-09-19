import {
  FullContentAssetChannel,
  RefreshContentAssetChannelResponse,
} from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
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
export class RefreshContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Post("/content/channel/:channelId/refresh")
  @ApiOperation({
    summary: "Refreshes an existing content asset channel",
    description: "Refreshes an existing content asset channel.",
    operationId: "RefreshContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: RefreshContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Res() response: Response,
  ): Promise<void> {
    const updatedCategory: FullContentAssetChannel =
      await this.contentAssetChannels.refresh(channelId);

    const responseBody: RefreshContentAssetChannelResponse = {
      channel: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
