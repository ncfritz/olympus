import {
  MediaAssetSearchType,
  SingleMediaFavoriteResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiGoneResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaFavoriteService } from "../services/MediaFavoriteService";

@Controller({ version: "1" })
export class DeleteMediaFavoriteController {
  constructor(private readonly mediaFavorites: MediaFavoriteService) {}

  @Delete("/media/favorite/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Removes a media favorite",
    description: "Removes a media item from the favorites.",
    operationId: "DeleteMediaFavorite",
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
  @ApiGoneResponse({
    description: "The media favorite was removed.",
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
      favorite: await this.mediaFavorites.delete(mediaType, mediaId),
    };

    response.status(HttpStatus.GONE).send(responseBody);
  }
}
