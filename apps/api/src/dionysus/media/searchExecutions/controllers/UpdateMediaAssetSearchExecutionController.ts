import {
  MediaAssetSearchType,
  SingleMediaAssetSearchExecutionResponse,
  UpdateMediaAssetSearchExecutionRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
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
import { MediaAssetSearchExecutionService } from "../services/MediaAssetSearchExecutionService";

@Controller({ version: "1" })
export class UpdateMediaAssetSearchExecutionController {
  constructor(
    private readonly searchExecutions: MediaAssetSearchExecutionService,
  ) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId/execution/:executionId")
  @ApiOperation({
    summary: "Updates an existing media search execution",
    description: "Updates an existing media search execution.",
    operationId: "UpdateMediaAssetSearchExecution",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetSearchExecutionRequest,
    description: "Input for the UpdateMediaAssetSearchExecution operation",
  })
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
    description: "The ID of the search execution to update.",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetSearchExecutionResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("executionId") executionId: string,
    @Body() request: UpdateMediaAssetSearchExecutionRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: await this.searchExecutions.update(
        executionId,
        request.searchExecution,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
