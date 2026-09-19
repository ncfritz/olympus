import {
  MediaAssetSearchType,
  SingleMediaAssetDownloadResponse,
  UpdateMediaAssetDownloadRequest,
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
import { MediaAssetDownloadService } from "../services/MediaAssetDownloadService";

@Controller({ version: "1" })
export class UpdateMediaAssetDownloadController {
  constructor(
    private readonly mediaAssetDownloads: MediaAssetDownloadService,
  ) {}

  @Put(
    "/media/searchConfiguration/:mediaType/:mediaId/result/:resultId/download/:downloadId",
  )
  @ApiOperation({
    summary: "Updates an existing media download",
    description: "Updates an existing media download.",
    operationId: "UpdateMediaAssetDownload",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetDownloadRequest,
    description: "Input for the UpdateMediaAssetDownload operation",
  })
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the download is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    enumSchema: { description: "The type of media asset" },
  })
  @ApiParam({
    name: "mediaId",
    description: "The ID of the media that the download is targeting.",
    type: Number,
  })
  @ApiParam({
    name: "resultId",
    description: "The ID of the search result that the download is targeting.",
    type: String,
  })
  @ApiParam({
    name: "downloadId",
    description: "The ID of the download.",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetDownloadResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("resultId") resultId: string,
    @Param("downloadId") downloadId: string,
    @Body() request: UpdateMediaAssetDownloadRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetDownloadResponse = {
      download: await this.mediaAssetDownloads.update(
        resultId,
        downloadId,
        request.download,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
