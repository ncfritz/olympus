import {
  CreateMediaAssetSearchResultRequest,
  MediaAssetSearchResult,
  MediaAssetSearchType,
  SingleMediaAssetSearchResultResponse,
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
import { toDomainObject } from "../converters/MediaAssetSearchResultConverter";
import { BASE_SEARCH_RESULT } from "../queries/searchResult";
import { GraphQlMediaAssetSearchResult } from "../types/searchResult";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseMediaAssetSearchConfigurationController } from "../../searchConfigurations/controllers/BaseMediaAssetSearchConfigurationController";
import { DescribeMediaAssetSearchResultController } from "./DescribeMediaAssetSearchResultController";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateMediaAssetSearchResultResponse = {
  insert_dionysus_media_asset_search_result_one: GraphQlMediaAssetSearchResult;
};

@Controller({ version: "1" })
export class CreateMediaAssetSearchResultController extends BaseMediaAssetSearchConfigurationController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/media/searchConfiguration/:mediaType/:mediaId/results")
  @ApiOperation({
    summary: "Creates a new media asset search result",
    description: "Creates a new media asset search result.",
    operationId: "CreateMediaAssetSearchResult",
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
    type: CreateMediaAssetSearchResultRequest,
    required: true,
    description: "Input for the CreateMediaAssetSearchResult operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetSearchResultResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created search result",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Body() request: CreateMediaAssetSearchResultRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifySearchConfiguration(mediaType, mediaId);

    const insertRequest = gql`
      mutation CreateMediaAssetSearchResult(
        $id: String!
        $assetType: String!
        $mediaId: numeric!
        $title: String!
        $score: numeric!
        $size: numeric!
        $password: numeric!
        $quality: String!
        $qualityGroup: String!
        $source: numeric!
        $modifier: numeric!
        $resolution: numeric!
        $repack: Boolean!
        $postedTime: timestamptz!
        $tags: [dionysus_media_asset_search_result_tag_insert_input!]!
      ) {
        insert_dionysus_media_asset_search_result_one(
          object: {
            id: $id
            assetType: $assetType
            mediaId: $mediaId
            title: $title
            score: $score
            size: $size
            password: $password
            quality: $quality
            qualityGroup: $qualityGroup
            source: $source
            modifier: $modifier
            resolution: $resolution
            repack: $repack
            postedTime: $postedTime
            tags: {
              data: $tags
            }
          }
        ) {
          ${BASE_SEARCH_RESULT}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetSearchResultResponse>(
        insertRequest,
        {
          id: request.searchResult.id,
          title: request.searchResult.title,
          score: request.searchResult.score,
          assetType: mediaType,
          mediaId: mediaId,
          size: request.searchResult.size,
          password: request.searchResult.password,
          quality: request.searchResult.quality,
          qualityGroup: request.searchResult.qualityGroup,
          source: request.searchResult.source,
          modifier: request.searchResult.modifier,
          resolution: request.searchResult.resolution,
          repack: request.searchResult.repack,
          postedTime: request.searchResult.postedTime,
          tags: request.searchResult.tags || [],
        },
      );

    const createdSearchResult: MediaAssetSearchResult = toDomainObject(
      insertResponse.insert_dionysus_media_asset_search_result_one,
    );

    const responseBody: SingleMediaAssetSearchResultResponse = {
      searchResult: createdSearchResult,
    };

    setLocation(
      response,
      httpRequest,
      DescribeMediaAssetSearchResultController,
      { mediaType, mediaId, resultId: createdSearchResult.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
