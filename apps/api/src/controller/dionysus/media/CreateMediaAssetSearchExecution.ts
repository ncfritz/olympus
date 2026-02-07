import {
  CreateMediaAssetSearchExecutionRequest,
  MediaAssetSearchExecution,
  MediaAssetSearchType,
  SearchExecutionStatus,
  SingleMediaAssetSearchExecutionResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchExecutionConverter";
import { SEARCH_EXECUTION } from "../../../query/dionysus/media/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../../../types/dionysus/media/searchExecution";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlVerifySearchConfigResponse = {
  dionysus_media_asset_search_configuration_by_pk: {
    assetType: MediaAssetSearchType;
    mediaId: number;
  };
};

type GraphQlCreateMediaAssetSearchExecutionResponse = {
  insert_dionysus_media_asset_search_execution_one: GraphQlMediaAssetSearchExecution;
};

@Controller({ version: "1" })
export class CreateMediaAssetSearchExecutionController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Post("/media/searchConfiguration/:mediaType/:mediaId/executions")
  @ApiOperation({
    summary: "Creates a new media asset search execution",
    description: "Creates a new media asset search execution.",
    operationId: "CreateMediaAssetSearchExecution",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type media asset the search configuration is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
  })
  @ApiParam({
    name: "mediaId",
    description:
      "The ID of the media that the search configuration is targeting.",
    type: Number,
  })
  @ApiBody({
    type: CreateMediaAssetSearchExecutionRequest,
    required: true,
    description: "Input for the CreateMediaAssetSearchExecution operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetSearchExecutionResponse,
    headers: {
      Location: {
        description: "The location of the created search execution",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Body() request: CreateMediaAssetSearchExecutionRequest,
    @Res() response: Response,
  ): Promise<void> {
    const verifyQuery = gql`
      query VerifyMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_configuration_by_pk(
          assetType: $assetType
          mediaId: $mediaId
        ) {
          assetType
          mediaId
        }
      }
    `;

    const verifyResponse =
      await this.graphQLClient.request<GraphQlVerifySearchConfigResponse>(
        verifyQuery,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    console.log(verifyResponse);

    if (
      !(
        verifyResponse.dionysus_media_asset_search_configuration_by_pk
          .assetType &&
        verifyResponse.dionysus_media_asset_search_configuration_by_pk.mediaId
      )
    ) {
      throw new BadRequestException(
        "Source search configuration definition could not be found",
      );
    }

    const insertRequest = gql`
      mutation CreateMediaAssetSearchExecution(
        $status: String!
        $searchType: String!
        $mediaId: numeric!
      ) {
        insert_dionysus_media_asset_search_execution_one(
          object: {
            status: $status
            searchType: $searchType
            mediaId: $mediaId
          }
        ) {
          ${SEARCH_EXECUTION}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchExecutionResponse>(
        insertRequest,
        {
          searchType: mediaType,
          mediaId: mediaId,
          status: SearchExecutionStatus.RUNNING,
        },
      );

    const createdSearchExecution: MediaAssetSearchExecution = toDomainObject(
      insertResponse.insert_dionysus_media_asset_search_execution_one,
    );

    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: createdSearchExecution,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/searchConfiguration/${mediaType}/${mediaId}/execution/${encodeURIComponent(
          createdSearchExecution.id,
        )}`,
      )
      .send(responseBody);
  }
}
