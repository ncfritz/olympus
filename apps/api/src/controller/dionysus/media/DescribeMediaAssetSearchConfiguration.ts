import {
  MediaAssetSearchType,
  SingleMediaAssetSearchConfigurationResponse,
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
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetSearchConfigurationConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { GraphQlMediaAssetSearchConfiguration } from "../../../types/dionysus/media/searchConfiguration";

type GraphQlGetMediaAssetSearchConfigurationResponse = {
  dionysus_media_asset_search_configuration_by_pk: GraphQlMediaAssetSearchConfiguration;
};

@Controller({ version: "1" })
export class DescribeMediaAssetSearchConfigurationController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId")
  @ApiOperation({
    summary: "Describes an existing media asset search configuration",
    description: "Retrieves the details of a media asset search configuration.",
    operationId: "DescribeMediaAssetSearchConfiguration",
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
  @ApiOkResponse({
    type: SingleMediaAssetSearchConfigurationResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType") mediaType: MediaAssetSearchType,
    @Param("mediaId") mediaId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMediaAssetSearchConfiguration(
        $assetType: String!
        $mediaId: numeric!
      ) {
        dionysus_media_asset_search_configuration_by_pk(
          assetType: $assetType
          mediaId: $mediaId
        ) {
          assetType
          mediaId
          seriesId
          seasonNumber
          episodeNumber
          backoff
          createdTime
          enabled
          jitter
          lastExecutionTime
          lastModifiedTime
          nextExecutionTime
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetSearchConfigurationResponse>(
        fetchRequest,
        {
          assetType: mediaType,
          mediaId: mediaId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_search_configuration_by_pk) {
      throw new NotFoundException();
    }

    const fetchedSearchConfiguration = toDomainObject(
      fetchResponse.dionysus_media_asset_search_configuration_by_pk,
    );

    const responseBody: SingleMediaAssetSearchConfigurationResponse = {
      searchConfiguration: fetchedSearchConfiguration,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
