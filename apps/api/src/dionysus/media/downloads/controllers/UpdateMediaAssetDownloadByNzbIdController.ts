import {
  SingleMediaAssetDownloadResponse,
  UpdateMediaAssetDownloadByNzbIdRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
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
import { MediaAssetDownloadService } from "../services/MediaAssetDownloadService";

@Controller({ version: "1" })
export class UpdateMediaAssetDownloadByNzbIdController {
  constructor(
    private readonly mediaAssetDownloads: MediaAssetDownloadService,
  ) {}

  @Put("/media/download/:nzbId")
  @ApiOperation({
    summary: "UpdateMediaAssetDownloadByNzbId",
    description: "Updates an existing media download by NZB ID.",
    operationId: "UpdateMediaAssetDownloadByNzbId",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetDownloadByNzbIdRequest,
    description: "Input for the UpdateMediaAssetDownload operation",
  })
  @ApiParam({
    name: "nzbId",
    description: "The nzbId associated with the download",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetDownloadResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("nzbId", ParseIntPipe) nzbId: number,
    @Body() request: UpdateMediaAssetDownloadByNzbIdRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetDownloadResponse = {
      download: await this.mediaAssetDownloads.updateByNzbId(nzbId, request),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
