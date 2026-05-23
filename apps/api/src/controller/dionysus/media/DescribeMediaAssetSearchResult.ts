import {
  MediaAssetSearchType,
  SingleMediaAssetSearchResultResponse,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchResultConverter";
import { BASE_SEARCH_RESULT } from "../../../query/dionysus/media/searchResult";
import { GraphQlMediaAssetSearchResult } from "../../../types/dionysus/media/searchResult";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMediaAssetSearchResultResponse = {
  dionysus_media_asset_search_result_by_pk: GraphQlMediaAssetSearchResult;
};

@Controller({ version: "1" })
export class DescribeMediaAssetSearchResultController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/result/:resultId")
  @ApiOperation({
    summary: "Describes an existing media asset search result",
    description: "Retrieves the details of a media asset search result.",
    operationId: "DescribeMediaAssetSearchResult",
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
    name: "resultId",
    description: "The ID of the result to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetSearchResultResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Param("resultId") resultId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchResult(
        $resultId: String!
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_result_by_pk(
          id: $resultId
          assetType: $assetType
          mediaId: $mediaId
        ) {
          ${BASE_SEARCH_RESULT}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchResultResponse>(
        fetchRequest,
        {
          resultId: resultId,
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_search_result_by_pk) {
      throw new NotFoundException();
    }

    const fetchedSearchResult = toDomainObject(
      fetchResponse.dionysus_media_asset_search_result_by_pk,
    );

    const responseBody: SingleMediaAssetSearchResultResponse = {
      searchResult: fetchedSearchResult,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
