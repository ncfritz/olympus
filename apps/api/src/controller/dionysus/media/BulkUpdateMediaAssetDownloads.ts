import {
  BulkUpdateMediaAssetDownloadsResponse,
  BulkUpdateMediaAssetDownloadStatusRequest,
  MediaAssetDownload,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetDownloadConverter";
import { BASE_MEDIA_DOWNLOAD } from "../../../query/dionysus/media/mediaDownload";
import { GraphQlMediaAssetDownload } from "../../../types/dionysus/media/mediaDownload";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class BulkUpdateMediaAssetDownloadsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/downloads/bulk")
  @ApiOperation({
    summary: "BulkUpdateMediaAssetDownloads",
    description:
      "Updates a set of media asset downloads.  This is a bulk update that will be applied in a single transaction.",
    operationId: "BulkUpdateMediaAssetDownloads",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: BulkUpdateMediaAssetDownloadStatusRequest,
    description: "Input for the UpdateMediaAssetDownload operation",
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: BulkUpdateMediaAssetDownloadsResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Body() request: BulkUpdateMediaAssetDownloadStatusRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updates: string[] = [];

    request.updates.forEach((update, index) => {
      updates.push(
        `update${index}: update_dionysus_media_asset_download(where: {nzbId: {_eq: ${update.nzbId}}}, _set: {progress: ${update.progress}, status: "${update.status}"}) {
          returning {
            ${BASE_MEDIA_DOWNLOAD}
          }
        }`,
      );
    });

    const updateRequest = gql`
      mutation BulkUpdateMediaAssetDownload {
        ${updates.join("\n")}
      }
    `;

    const updateResponse = await this.graphQLClient.request(updateRequest);
    const appliedUpdates: MediaAssetDownload[] = [];

    Object.values(updateResponse).forEach((update: any) => {
      appliedUpdates.push(
        toDomainObject(update.returning[0] as GraphQlMediaAssetDownload),
      );
    });

    const responseBody: BulkUpdateMediaAssetDownloadsResponse = {
      updates: appliedUpdates,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
