import {
  MediaAssetSearchType,
  SingleMediaFavoriteResponse,
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
import { MediaFavoriteService } from "../services/MediaFavoriteService";

@Controller({ version: "1" })
export class CreateMediaFavoriteController {
  constructor(private readonly mediaFavorites: MediaFavoriteService) {}

  @Post("/media/favorite/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Creates a new media favorite",
    description: "Creates a new media favorite.",
    operationId: "CreateMediaFavorite",
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
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaFavoriteResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaFavoriteResponse = {
      favorite: await this.mediaFavorites.create(mediaType, mediaId),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
