import {
  FullContentAssetChannel,
  UpdateContentAssetChannelRequest,
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
export class UpdateContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Put("/content/channel/:channelId")
  @ApiOperation({
    summary: "Updates an existing content asset channel",
    description: "Updates an existing content asset channel.",
    operationId: "UpdateContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: UpdateContentAssetChannelRequest,
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
    type: UpdateContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Body() request: UpdateContentAssetChannelRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updatedCategory: FullContentAssetChannel =
      await this.contentAssetChannels.update(channelId, request.channel);

    const responseBody: UpdateContentAssetChannelResponse = {
      channel: updatedCategory,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
