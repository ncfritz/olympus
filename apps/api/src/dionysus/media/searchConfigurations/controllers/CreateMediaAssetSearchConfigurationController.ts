import {
  CreateMediaAssetSearchConfigurationRequest,
  SingleMediaAssetSearchConfigurationResponse,
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
import { DescribeMediaAssetSearchConfigurationController } from "./DescribeMediaAssetSearchConfigurationController";
import { setLocation } from "../../../../utils/location";
import { MediaAssetSearchConfigurationService } from "../services/MediaAssetSearchConfigurationService";

@Controller({ version: "1" })
export class CreateMediaAssetSearchConfigurationController {
  constructor(
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  @Post("/media/searchConfigurations")
  @ApiOperation({
    summary: "Creates a new media asset search configuration",
    description:
      "Creates a new media asset search configuration.  The search will not be immediately executed, however the " +
      "`nextExecutionTime` will be calculated based on the current time and the jitter value provided.  If the " +
      "media the search configuration is being created for has an existing asset associated with it, the search " +
      "configuration will be disabled by default.  If no asset exists for the media, the configuration will be " +
      "enabled.",
    operationId: "CreateMediaAssetSearchConfiguration",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMediaAssetSearchConfigurationRequest,
    required: true,
    description: "Input for the CreateMediaAssetSearchConfiguration operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetSearchConfigurationResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created search configuration",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMediaAssetSearchConfigurationRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdSearchConfiguration = await this.searchConfigurations.create(
      request.searchConfiguration,
    );

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: createdSearchConfiguration,
    };

    setLocation(
      response,
      httpRequest,
      DescribeMediaAssetSearchConfigurationController,
      {
        mediaType: createdSearchConfiguration.type,
        mediaId: createdSearchConfiguration.mediaId,
      },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
