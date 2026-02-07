import {
  MediaAssetSearchType,
  SingleMediaAssetSearchExecutionResponse,
  UpdateMediaAssetSearchExecutionRequest,
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
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchExecutionConverter";
import { SEARCH_EXECUTION } from "../../../query/dionysus/media/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../../../types/dionysus/media/searchExecution";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateMediaAssetSearchExecutionResponse = {
  update_dionysus_media_asset_search_execution_by_pk: GraphQlMediaAssetSearchExecution;
};

@Controller({ version: "1" })
export class UpdateMediaAssetSearchExecutionController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/searchConfiguration/:mediaType/:mediaId/execution/:executionId")
  @ApiOperation({
    summary: "Updates an existing media search execution",
    description: "Updates an existing media search execution.",
    operationId: "UpdateMediaAssetSearchExecution",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetSearchExecutionRequest,
    description: "Input for the UpdateMediaAssetSearchExecution operation",
  })
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
  @ApiParam({
    name: "executionId",
    description: "The ID of the search execution to update.",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetSearchExecutionResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Param("executionId") executionId: string,
    @Body() request: UpdateMediaAssetSearchExecutionRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateMediaAssetSearchExecution(
        $executionId: uuid!
        $changes: dionysus_media_asset_search_execution_set_input = {}
      ) {
        update_dionysus_media_asset_search_execution_by_pk(
          pk_columns: { id: $executionId }
          _set: $changes
        ) {
          ${SEARCH_EXECUTION}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMediaAssetSearchExecutionResponse>(
        updateRequest,
        {
          executionId: executionId,
          changes: request.searchExecution,
        },
      );

    const updatedSearchExecution = toDomainObject(
      updateResponse.update_dionysus_media_asset_search_execution_by_pk,
    );

    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: updatedSearchExecution,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
