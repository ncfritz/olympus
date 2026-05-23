import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetDownload,
  MediaAssetSearchType,
  MediaDownloadStatus,
  SearchResultStatus,
  SingleMediaAssetDownloadResponse,
} from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetDownloadConverter";
import { BASE_MEDIA_DOWNLOAD } from "../../../query/dionysus/media/mediaDownload";
import { GraphQlMediaAssetDownload } from "../../../types/dionysus/media/mediaDownload";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetSearchResultController } from "./BaseMediaAssetSearchResultController";

type GraphQlCreateMediaAssetDownloadResponse = {
  insert_dionysus_media_asset_download_one: GraphQlMediaAssetDownload;
  update_dionysus_media_asset_search_result_by_pk: {
    status: string;
  };
};

@Controller({ version: "1" })
export class CreateMediaAssetDownloadController extends BaseMediaAssetSearchResultController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Post(
    "/media/searchConfiguration/:mediaType/:mediaId/result/:resultId/download",
  )
  @ApiOperation({
    summary: "Creates a new media asset download",
    description: "Creates a new media asset download.",
    operationId: "CreateMediaAssetDownload",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type media asset the search download is for",
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
    description: "The ID of the search result to download.",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetDownloadResponse,
    headers: {
      Location: {
        description: "The location of the media download record",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Param("resultId") resultId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifySearchResult(mediaType, mediaId, resultId);

    const insertRequest = gql`
      mutation CreateMediaAssetDownload(
        $status: String!
        $searchResultId: String!
        $progress: numeric!
        $assetType: String!
        $mediaId: numeric!
        $searchResultStatus: String!
      ) {
        insert_dionysus_media_asset_download_one(
          object: {
            status: $status
            searchResultId: $searchResultId
            progress: $progress
          }
        ) {
          ${BASE_MEDIA_DOWNLOAD}
        }
        update_dionysus_media_asset_search_result_by_pk(pk_columns: {assetType: $assetType, id: $searchResultId, mediaId: $mediaId}, _set: {status: $searchResultStatus}) {
          status
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetDownloadResponse>(
        insertRequest,
        {
          status: MediaDownloadStatus.PENDING,
          progress: 0,
          searchResultId: resultId,
          assetType: mediaType,
          mediaId: mediaId,
          searchResultStatus: SearchResultStatus.DOWNLOAD_REQUESTED,
        },
      );

    const createdDownload: MediaAssetDownload = toDomainObject(
      insertResponse.insert_dionysus_media_asset_download_one,
    );

    await this.amqpConnection.publish(
      "download.trigger",
      "download.start",
      {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: resultId,
        downloadId: createdDownload.id,
        nzbId: resultId,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 10000,
        },
      },
    );

    const responseBody: SingleMediaAssetDownloadResponse = {
      download: createdDownload,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/searchConfiguration/${mediaType}/${mediaId}/result/${encodeURIComponent(
          resultId,
        )}/download/${encodeURIComponent(createdDownload.id)}`,
      )
      .send(responseBody);
  }
}
