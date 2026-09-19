import {
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
  UpdateMediaAssetSearchConfigurationRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  DefaultValuePipe,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseIntPipe,
  Put,
  Query,
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
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetSearchConfigurationService } from "../services/MediaAssetSearchConfigurationService";

@Controller({ version: "1" })
export class UpdateMediaAssetSearchConfigurationController {
  constructor(
    private readonly searchConfigurations: MediaAssetSearchConfigurationService,
  ) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Updates an existing media search configuration",
    description:
      "Updates an existing media search configuration. When `recursive` is `true`, a change to the `enabled` status is also applied to child configurations (for example, disabling a TV season's configuration disables its episodes' configurations). Otherwise only the identified configuration is updated.",
    operationId: "UpdateMediaAssetSearchConfiguration",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetSearchConfigurationRequest,
    description: "Input for the UpdateMediaAssetSearchConfiguration operation",
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
  @ApiQuery({
    name: "recursive",
    description:
      "When set to `true` any child entities - seasons/episodes - will be updated with the specified `enabled` status.",
    type: Boolean,
    required: false,
    default: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetSearchConfigurationResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Query("recursive", new DefaultValuePipe(false), ParseBoolPipe)
    recursive: boolean,
    @Body() request: UpdateMediaAssetSearchConfigurationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: await this.searchConfigurations.update(
        mediaType,
        mediaId,
        request.searchConfiguration,
        recursive,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
