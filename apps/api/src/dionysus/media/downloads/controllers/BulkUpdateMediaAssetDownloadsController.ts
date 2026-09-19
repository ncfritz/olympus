import {
  BulkUpdateMediaAssetDownloadsResponse,
  BulkUpdateMediaAssetDownloadStatusRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetDownloadService } from "../services/MediaAssetDownloadService";

@Controller({ version: "1" })
export class BulkUpdateMediaAssetDownloadsController {
  constructor(
    private readonly mediaAssetDownloads: MediaAssetDownloadService,
  ) {}

  @Put("/media/downloads/bulk")
  @ApiOperation({
    summary: "BulkUpdateMediaAssetDownloads",
    description:
      "Updates a set of media asset downloads.  This is a bulk update that will be applied in a single transaction.",
    operationId: "BulkUpdateMediaAssetDownloads",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: BulkUpdateMediaAssetDownloadStatusRequest,
    description: "Input for the UpdateMediaAssetDownload operation",
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: BulkUpdateMediaAssetDownloadsResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Body() request: BulkUpdateMediaAssetDownloadStatusRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: BulkUpdateMediaAssetDownloadsResponse = {
      updates: await this.mediaAssetDownloads.bulkUpdate(request),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
