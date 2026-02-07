import {
  MediaAssetSearchType,
  SingleMediaAssetSearchExecutionResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
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

type GraphQlGetMediaAssetSearchExecutionResponse = {
  dionysus_media_asset_search_execution_by_pk: GraphQlMediaAssetSearchExecution;
};

@Controller({ version: "1" })
export class DescribeMediaAssetSearchExecutionController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/execution/:executionId")
  @ApiOperation({
    summary: "Describes an existing media asset search execution",
    description: "Retrieves the details of a media asset search execution.",
    operationId: "DescribeMediaAssetSearchExecution",
    tags: ["Media"],
  })
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
  @ApiParam({
    name: "executionId",
    description: "The ID of the execution to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetSearchExecutionResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Param("executionId") executionId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchExecution(
        $executionId: uuid!
      ) {
        dionysus_media_asset_search_execution_by_pk(
          id: $executionId
        ) {
          ${SEARCH_EXECUTION}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchExecutionResponse>(
        fetchRequest,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_search_execution_by_pk) {
      throw new NotFoundException();
    }

    const fetchedSearchExecution = toDomainObject(
      fetchResponse.dionysus_media_asset_search_execution_by_pk,
    );

    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: fetchedSearchExecution,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
