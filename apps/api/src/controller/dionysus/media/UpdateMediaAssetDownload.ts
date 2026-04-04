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
  Param,
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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetDownloadConverter";
import { BASE_MEDIA_DOWNLOAD } from "../../../query/dionysus/media/mediaDownload";
import { GraphQlMediaAssetDownload } from "../../../types/dionysus/media/mediaDownload";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateChildMediaAssetDownloadResponse = {
  update_dionysus_media_asset_download_by_pk: GraphQlMediaAssetDownload;
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
    description: "The type media asset the download is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
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
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
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

    const updatedDownload = toDomainObject(
      updateResponse.update_dionysus_media_asset_download_by_pk,
    );

    const responseBody: SingleMediaAssetDownloadResponse = {
      download: updatedDownload,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
