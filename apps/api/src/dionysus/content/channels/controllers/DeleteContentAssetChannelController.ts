import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiGoneResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";

@Controller({ version: "1" })
export class DeleteContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Delete("/content/channel/:channelId")
  @ApiOperation({
    summary: "Deletes an existing content asset channel",
    description: "Deletes an existing content asset channel.",
    operationId: "DeleteContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "channelId",
    description: "The ID of the channel to delete",
    type: String,
  })
  @ApiGoneResponse({
    description: "The content asset channel was successfully removed.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("channelId") channelId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.contentAssetChannels.delete(channelId);

    response.status(HttpStatus.GONE).send({});
  }
}
