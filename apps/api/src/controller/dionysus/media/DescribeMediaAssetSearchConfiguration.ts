import {
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetSearchConfigurationController } from "./BaseMediaAssetSearchConfigurationController";

@Controller({ version: "1" })
export class DescribeMediaAssetSearchConfigurationController extends BaseMediaAssetSearchConfigurationController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Get("/media/searchConfiguration/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Describes an existing media asset search configuration",
    description: "Retrieves the details of a media asset search configuration.",
    operationId: "DescribeMediaAssetSearchConfiguration",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search configuration is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
  })
  @ApiParam({
    name: "mediaId",
    description:
      "The ID of the media that the search configuration is targeting.",
    type: Number,
  })
  @ApiOkResponse({
    type: SingleMediaAssetSearchConfigurationResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchedSearchConfiguration =
      await this.fetchMediaAssetSearchConfiguration(mediaType, mediaId);

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: fetchedSearchConfiguration,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
