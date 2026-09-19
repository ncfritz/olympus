import {
  CreateMediaAssetRequest,
  SingleMediaAssetResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetService } from "../services/MediaAssetService";

@Controller({ version: "1" })
export class CreateMediaAssetController {
  constructor(private readonly mediaAssets: MediaAssetService) {}

  @Post("/media/assets")
  @ApiOperation({
    summary: "Creates a new media asset",
    description: "Creates a new media asset.",
    operationId: "CreateMediaAsset",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMediaAssetRequest,
    required: true,
    description: "Input for the CreateMediaAsset operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMediaAssetRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetResponse = {
      asset: await this.mediaAssets.create(request.asset),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
