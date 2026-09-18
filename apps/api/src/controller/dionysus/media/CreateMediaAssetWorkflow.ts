import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetSearchType,
  DecoratedMediaAssetWorkflow,
  MediaAssetWorkflowStatus,
  MediaDownloadStatus,
  SearchResultStatus,
  SingleMediaAssetWorkflowResponse,
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
import moment from "moment";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowConverter";
import { DECORATED_MEDIA_ASSET_WORKFLOW } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflow } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetSearchResultController } from "./BaseMediaAssetSearchResultController";
import { v4 as uuidv4 } from "uuid";

type GraphQlCreateMediaAssetWorkflowResponse = {
  insert_dionysus_media_asset_download_one: {
    status: string;
  };
  insert_dionysus_media_asset_workflow_one: GraphQlDecoratedMediaAssetWorkflow;
  update_dionysus_media_asset_search_result_by_pk: {
    status: string;
  };
};

@Controller({ version: "1" })
export class CreateMediaAssetWorkflowController extends BaseMediaAssetSearchResultController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Post(
    "/media/searchConfiguration/:mediaType/:mediaId/workflow/:resultId/workflow",
  )
  @ApiOperation({
    summary: "Creates a new media asset workflow",
    description: "Creates a new media asset workflow.",
    operationId: "CreateMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search download is for",
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
    type: SingleMediaAssetWorkflowResponse,
    headers: {
      Location: {
        schema: { type: "string" },
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

    const workflowId = uuidv4();

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflow(
        $workflowId: uuid!
        $searchResultId: String!
        $assetType: String!
        $mediaId: numeric!
        $workflowStatus: String!
        $searchResultStatus: String!
        $startedTime: timestamptz!
        $downloadStatus: String!
        $downloadProgress: numeric!
      ) {
        insert_dionysus_media_asset_download_one(
          object: {
            status: $downloadStatus
            searchResultId: $searchResultId
            progress: $downloadProgress
            workflowId: $workflowId
            assetType: $assetType
            mediaId: $mediaId
          }
        ) {
          status
        }
        insert_dionysus_media_asset_workflow_one(object: {
          id: $workflowId
          type: $assetType 
          mediaId: $mediaId 
          status: $workflowStatus 
          startedTime: $startedTime
        }) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
        update_dionysus_media_asset_search_result_by_pk(
          pk_columns: {
            assetType: $assetType 
            id: $searchResultId
            mediaId: $mediaId
          }, _set: {
            status: $searchResultStatus
          }
        ) {
            status
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          assetType: mediaType,
          mediaId: mediaId,
          workflowStatus: MediaAssetWorkflowStatus.QUEUED,
          startedTime: moment.utc().toISOString(),
          downloadStatus: MediaDownloadStatus.PENDING,
          downloadProgress: 0,
          searchResultId: resultId,
          searchResultStatus: SearchResultStatus.DOWNLOAD_REQUESTED,
        },
      );

    const createdWorkflow: DecoratedMediaAssetWorkflow =
      toDecoratedDomainObject(
        insertResponse.insert_dionysus_media_asset_workflow_one,
      );

    await this.amqpConnection.publish(
      "download.trigger",
      "download.start",
      {
        mediaType: mediaType,
        mediaId: mediaId,
        resultId: resultId,
        workflowId: createdWorkflow.id,
        downloadId: createdWorkflow.download.id,
        nzbId: resultId,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 10000,
        },
      },
    );

    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: createdWorkflow,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/searchConfiguration/${mediaType}/${mediaId}/result/${encodeURIComponent(
          resultId,
        )}/workflow/${encodeURIComponent(createdWorkflow.id)}`,
      )
      .send(responseBody);
  }
}
