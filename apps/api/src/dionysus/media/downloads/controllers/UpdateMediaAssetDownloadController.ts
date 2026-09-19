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
  NotFoundException,
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
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetDownloadConverter";
import { BASE_MEDIA_DOWNLOAD } from "../queries/mediaDownload";
import { GraphQlMediaAssetDownload } from "../types/mediaDownload";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlUpdateChildMediaAssetDownloadResponse = {
  update_dionysus_media_asset_download_by_pk: GraphQlMediaAssetDownload | null;
};

@Controller({ version: "1" })
export class UpdateMediaAssetDownloadController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    const updateRequest = gql`
      mutation UpdateMediaAssetDownload(
        $downloadId: uuid!
        $searchResultId: String!
        $changes: dionysus_media_asset_download_set_input = {}
      ) {
        update_dionysus_media_asset_download_by_pk(
          pk_columns: { id: $downloadId, searchResultId: $searchResultId }
          _set: $changes
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetDownloadResponse>(
        updateRequest,
        {
          downloadId: downloadId,
          searchResultId: resultId,
          changes: request.download,
        },
      );

    if (!updateResponse.update_dionysus_media_asset_download_by_pk) {
      throw new NotFoundException();
    }

    const updatedDownload = toDomainObject(
      updateResponse.update_dionysus_media_asset_download_by_pk,
    );

    const responseBody: SingleMediaAssetDownloadResponse = {
      download: updatedDownload,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
