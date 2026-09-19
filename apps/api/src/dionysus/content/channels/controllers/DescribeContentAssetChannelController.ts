import {
  DescribeContentAssetChannelResponse,
  FullContentAssetChannel,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Req, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";
import { contentAuthToken } from "../../auth/contentAuth";

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
  async handle(
    @Param("channelId") channelId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const channel: FullContentAssetChannel =
      await this.contentAssetChannels.describe(
        channelId,
        contentAuthToken(request),
      );

    const responseBody: DescribeContentAssetChannelResponse = {
      channel: channel,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
