import {
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
} from "@ncfritz/olympus-model";
import {
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
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetSearchConfigurationService } from "../services/MediaAssetSearchConfigurationService";

@Controller({ version: "1" })
export class TriggerMediaAssetSearchController {
  constructor(
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId/trigger")
  @ApiOperation({
    summary: "Triggers an existing media search configuration",
    description:
      "Triggers an existing media search configuration. The search is enqueued for execution immediately, ignoring any `nextExecutionTime` on the search configuration.",
    operationId: "TriggerMediaAssetSearch",
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
  @ApiOkResponse({
    description: "The search has been successfully triggered.",
    type: SingleMediaAssetSearchConfigurationResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Res()
    response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: await this.searchConfigurations.trigger(
        mediaType,
        mediaId,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
