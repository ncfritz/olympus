import {
  CreateMediaAssetSearchExecutionRequest,
  MediaAssetSearchExecution,
  MediaAssetSearchType,
  SearchExecutionStatus,
  SingleMediaAssetSearchExecutionResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Req,
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
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetSearchExecutionConverter";
import { BASE_SEARCH_EXECUTION } from "../queries/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../types/searchExecution";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseMediaAssetSearchConfigurationController } from "../../searchConfigurations/controllers/BaseMediaAssetSearchConfigurationController";
import { DescribeMediaAssetSearchExecutionController } from "./DescribeMediaAssetSearchExecutionController";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateMediaAssetSearchExecutionResponse = {
  insert_dionysus_media_asset_search_execution_one: GraphQlMediaAssetSearchExecution;
};

@Controller({ version: "1" })
export class CreateMediaAssetSearchExecutionController extends BaseMediaAssetSearchConfigurationController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

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
        schema: { type: "string" },
        description: "The location of the created search execution",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Body() request: CreateMediaAssetSearchExecutionRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifySearchConfiguration(mediaType, mediaId);

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
          ${BASE_SEARCH_EXECUTION}
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

    setLocation(
      response,
      httpRequest,
      DescribeMediaAssetSearchExecutionController,
      { mediaType, mediaId, executionId: createdSearchExecution.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
