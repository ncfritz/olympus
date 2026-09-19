import {
  FullContentAssetChannel,
  CreateContentAssetChannelRequest,
  CreateContentAssetChannelResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeContentAssetChannelController } from "./DescribeContentAssetChannelController";
import { setLocation } from "../../../../utils/location";
import { ContentAssetChannelService } from "../services/ContentAssetChannelService";

@Controller({ version: "1" })
export class CreateContentAssetChannelController {
  constructor(
    private readonly contentAssetChannels: ContentAssetChannelService,
  ) {}

  @Post("/content/channels")
  @ApiOperation({
    summary: "Creates a new content asset channel",
    description: "Creates a new content asset channel.",
    operationId: "CreateContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetChannelRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetChannelResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetChannelRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdCategory: FullContentAssetChannel =
      await this.contentAssetChannels.create(request.channel);

    const responseBody: CreateContentAssetChannelResponse = {
      channel: createdCategory,
    };

    setLocation(response, httpRequest, DescribeContentAssetChannelController, {
      channelId: createdCategory.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
