import {
  MediaAssetSearchType,
  SingleMediaAssetSearchExecutionResponse,
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetSearchExecutionService } from "../services/MediaAssetSearchExecutionService";

@Controller({ version: "1" })
export class DescribeMediaAssetSearchExecutionController {
  constructor(
    private readonly searchExecutions: MediaAssetSearchExecutionService,
  ) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/execution/:executionId")
  @ApiOperation({
    summary: "Describes an existing media asset search execution",
    description: "Retrieves the details of a media asset search execution.",
    operationId: "DescribeMediaAssetSearchExecution",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search configuration is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    enumSchema: { description: "The type of media asset" },
  })
  @ApiParam({
    name: "mediaId",
    description:
      "The ID of the media that the search configuration is targeting.",
    type: Number,
  })
  @ApiParam({
    name: "executionId",
    description: "The ID of the execution to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetSearchExecutionResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("executionId") executionId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: await this.searchExecutions.describe(
        mediaType,
        mediaId,
        executionId,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
