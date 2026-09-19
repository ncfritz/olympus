import {
  MediaAssetSearchType,
  SingleMediaAssetDownloadResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetDownloadService } from "../services/MediaAssetDownloadService";

@Controller({ version: "1" })
export class CreateMediaAssetDownloadController {
  constructor(
    private readonly mediaAssetDownloads: MediaAssetDownloadService,
  ) {}

  @Post(
    "/media/searchConfiguration/:mediaType/:mediaId/result/:resultId/download",
  )
  @ApiOperation({
    summary: "Creates a new media asset download",
    description: "Creates a new media asset download.",
    operationId: "CreateMediaAssetDownload",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search download is for",
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
    description: "The ID of the search result to download.",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetDownloadResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("resultId") resultId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetDownloadResponse = {
      download: await this.mediaAssetDownloads.create(
        mediaType,
        mediaId,
        resultId,
      ),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
