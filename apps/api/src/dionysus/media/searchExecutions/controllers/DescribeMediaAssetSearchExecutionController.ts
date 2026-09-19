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
  ParseEnumPipe,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MediaAssetSearchExecutionConverter";
import { BASE_SEARCH_EXECUTION } from "../queries/searchExecution";
import { GraphQlMediaAssetSearchExecution } from "../types/searchExecution";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMediaAssetSearchExecutionResponse = {
  dionysus_media_asset_search_execution_by_pk: GraphQlMediaAssetSearchExecution | null;
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
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
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
          ${BASE_SEARCH_EXECUTION}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchExecutionResponse>(
        fetchRequest,
        { executionId: executionId },
      );

    const execution = fetchResponse.dionysus_media_asset_search_execution_by_pk;

    // Executions are addressed under their search configuration.
    if (
      !execution ||
      execution.searchType !== mediaType ||
      Number(execution.mediaId) !== mediaId
    ) {
      throw new NotFoundException();
    }

    const fetchedSearchExecution = toDomainObject(execution);

    const responseBody: SingleMediaAssetSearchExecutionResponse = {
      searchExecution: fetchedSearchExecution,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
