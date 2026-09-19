import {
  CreateMediaAssetSearchResultRequest,
  MediaAssetSearchType,
  SingleMediaAssetSearchResultResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMediaAssetSearchResultController } from "./DescribeMediaAssetSearchResultController";
import { setLocation } from "../../../../utils/location";
import { MediaAssetSearchResultService } from "../services/MediaAssetSearchResultService";

@Controller({ version: "1" })
export class CreateMediaAssetSearchResultController {
  constructor(private readonly searchResults: MediaAssetSearchResultService) {}

  @Post("/media/searchConfiguration/:mediaType/:mediaId/results")
  @ApiOperation({
    summary: "Creates a new media asset search result",
    description: "Creates a new media asset search result.",
    operationId: "CreateMediaAssetSearchResult",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
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
  @ApiBody({
    type: CreateMediaAssetSearchResultRequest,
    required: true,
    description: "Input for the CreateMediaAssetSearchResult operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetSearchResultResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created search result",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Body() request: CreateMediaAssetSearchResultRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdSearchResult = await this.searchResults.create(
      mediaType,
      mediaId,
      request.searchResult,
    );

    const responseBody: SingleMediaAssetSearchResultResponse = {
      searchResult: createdSearchResult,
    };

    setLocation(
      response,
      httpRequest,
      DescribeMediaAssetSearchResultController,
      { mediaType, mediaId, resultId: createdSearchResult.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
