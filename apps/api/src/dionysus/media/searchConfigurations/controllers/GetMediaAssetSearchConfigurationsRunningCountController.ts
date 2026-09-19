import {
  GetMediaAssetSearchConfigurationsRunningCountResponse,
  MediaAssetSearchType,
} from "@ncfritz/olympus-model";
import {
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Put,
  Query,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetSearchConfigurationService } from "../services/MediaAssetSearchConfigurationService";

@Controller({ version: "1" })
export class GetMediaAssetSearchConfigurationsRunningCountController {
  constructor(
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId/running")
  @ApiOperation({
    summary:
      "Gets the number of search configurations that are marked as running for a TV series or season",
    description:
      "Gets the count of search configurations that are marked as `running` for a given TV series or season.",
    operationId: "GetMediaAssetSearchConfigurationsRunningCount",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
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
  @ApiQuery({
    name: "seasonNumber",
    description:
      "The season number, if the initially triggered search targeted a specific season.",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "The count has been successfully fetched.",
    type: GetMediaAssetSearchConfigurationsRunningCountResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Query("seasonNumber", new ParseIntPipe({ optional: true }))
    seasonNumber: number | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetMediaAssetSearchConfigurationsRunningCountResponse =
      {
        count: await this.searchConfigurations.getRunningCount(
          mediaType,
          mediaId,
          seasonNumber,
        ),
      };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
