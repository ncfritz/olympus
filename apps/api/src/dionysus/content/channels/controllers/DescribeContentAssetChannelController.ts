import {
  DescribeContentAssetChannelResponse,
  FullContentAssetChannel,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { ContentAuth, Curtain } from "../../auth/contentAuthDecorators";
import { ContentCurtain } from "../../auth/ContentCurtain";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";

@Controller({ version: "1" })
export class DescribeContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Get("/content/channel/:channelId")
  @ApiOperation({
    summary: "Describes a content asset channel",
    description: "Retrieves the details of a content asset channel.",
    operationId: "DescribeContentAssetChannel",
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
    type: DescribeContentAssetChannelResponse,
  })
  @ApiStandardErrorResponses()
  @ContentAuth()
  async handle(
    @Param("channelId") channelId: string,
    @Curtain() curtain: ContentCurtain,
    @Res() response: Response,
  ): Promise<void> {
    const channel: FullContentAssetChannel =
      await this.contentAssetChannels.describe(channelId, curtain);

    const responseBody: DescribeContentAssetChannelResponse = {
      channel: channel,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
