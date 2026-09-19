import {
  MediaAssetSearchType,
  SingleMediaAssetSearchResultResponse,
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
import { MediaAssetSearchResultService } from "../services/MediaAssetSearchResultService";

@Controller({ version: "1" })
export class DescribeMediaAssetSearchResultController {
  constructor(private readonly searchResults: MediaAssetSearchResultService) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/result/:resultId")
  @ApiOperation({
    summary: "Describes an existing media asset search result",
    description: "Retrieves the details of a media asset search result.",
    operationId: "DescribeMediaAssetSearchResult",
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
    name: "resultId",
    description: "The ID of the result to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetSearchResultResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("resultId") resultId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetSearchResultResponse = {
      searchResult: await this.searchResults.describe(
        mediaType,
        mediaId,
        resultId,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
