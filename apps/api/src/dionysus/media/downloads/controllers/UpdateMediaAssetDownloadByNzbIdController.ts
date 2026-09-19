import {
  MediaAssetSearchType,
  MediaDownloadStatus,
  SearchResultStatus,
  SingleMediaAssetDownloadResponse,
  UpdateMediaAssetDownloadByNzbIdRequest,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
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
import { logger } from "../../../../utils/logger";

type GraphQlLookupDownloadByNzbIdResponse = {
  dionysus_media_asset_download: {
    id: string;
    progress: number;
    status: MediaDownloadStatus;
    searchResult: {
      assetType: MediaAssetSearchType;
      mediaId: number;
      id: string;
    };
  }[];
};

type GraphQlUpdateChildMediaAssetDownloadResponse = {
  update_dionysus_media_asset_download_by_pk: GraphQlMediaAssetDownload;
  update_dionysus_media_asset_search_result_by_pk: {
    status: SearchResultStatus;
  };
};

@Controller({ version: "1" })
export class UpdateMediaAssetDownloadByNzbIdController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/download/:nzbId")
  @ApiOperation({
    summary: "UpdateMediaAssetDownloadByNzbId",
    description: "Updates an existing media download by NZB ID.",
    operationId: "UpdateMediaAssetDownloadByNzbId",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetDownloadByNzbIdRequest,
    description: "Input for the UpdateMediaAssetDownload operation",
  })
  @ApiParam({
    name: "nzbId",
    description: "The nzbId associated with the download",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetDownloadResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("nzbId", ParseIntPipe) nzbId: number,
    @Body() request: UpdateMediaAssetDownloadByNzbIdRequest,
    @Res() response: Response,
  ): Promise<void> {
    const locateDownloadRequest = gql`
      query LookupDownloadByNzbId($nzbId: numeric!) {
        dionysus_media_asset_download(where: { nzbId: { _eq: $nzbId } }) {
          id
          progress
          status
          searchResult {
            assetType
            mediaId
            id
          }
        }
      }
    `;

    const locateDownloadResponse =
      await this.graphQLClient.request<GraphQlLookupDownloadByNzbIdResponse>(
        locateDownloadRequest,
        { nzbId: nzbId },
      );

    if (locateDownloadResponse.dionysus_media_asset_download.length === 0) {
      throw new NotFoundException(`No download found for NZB ID ${nzbId}`);
    }

    if (
      request.download.progress &&
      request.download.progress <
        locateDownloadResponse.dionysus_media_asset_download[0].progress
    ) {
      logger.debug(
        `Download progress for NZB ID ${nzbId} is ${request.download.progress}, but download progress is ${locateDownloadResponse.dionysus_media_asset_download[0].progress}. Request progress will be ignored`,
      );

      request.download.progress =
        locateDownloadResponse.dionysus_media_asset_download[0].progress;
    }

    const downloadId = locateDownloadResponse.dionysus_media_asset_download[0];

    const updateRequest = gql`
      mutation UpdateMediaAssetDownloadByNzbId(
        $downloadId: uuid!
        $searchResultId: String!
        $assetType: String!
        $mediaId: numeric!
        $searchResultStatus: String!
        $changes: dionysus_media_asset_download_set_input = {}
      ) {
        update_dionysus_media_asset_download_by_pk(
          pk_columns: { id: $downloadId, searchResultId: $searchResultId }
          _set: $changes
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
        update_dionysus_media_asset_search_result_by_pk(
          pk_columns: {assetType: $assetType, id: $searchResultId, mediaId: $mediaId},
          _set: {status: $searchResultStatus}
        ) {
          status
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetDownloadResponse>(
        updateRequest,
        {
          downloadId: downloadId.id,
          searchResultId: downloadId.searchResult.id,
          assetType: downloadId.searchResult.assetType,
          mediaId: downloadId.searchResult.mediaId,
          searchResultStatus: request.searchResultStatus,
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
