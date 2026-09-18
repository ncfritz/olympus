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
import { type Response } from "express";
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
    // An update without an nzbId would match every download (Hasura v2
    // treats `_eq: null` as true), so those are skipped.
    const updates = request.updates.filter(
      (update) => update.nzbId !== undefined && update.nzbId !== null,
    );
    const appliedUpdates: MediaAssetDownload[] = [];

    if (updates.length > 0) {
      const variables: Record<string, unknown> = {};
      const declarations: string[] = [];
      const fields = updates.map((update, index) => {
        variables[`nzbId${index}`] = update.nzbId;
        variables[`progress${index}`] = update.progress;
        variables[`status${index}`] = update.status;
        declarations.push(
          `$nzbId${index}: numeric!, $progress${index}: numeric, $status${index}: String`,
        );
        return `update${index}: update_dionysus_media_asset_download(
          where: { nzbId: { _eq: $nzbId${index} } }
          _set: { progress: $progress${index}, status: $status${index} }
        ) {
          returning {
            ${BASE_MEDIA_DOWNLOAD}
          }
        }`;
      });

      const updateRequest = gql`
        mutation BulkUpdateMediaAssetDownloads(${declarations.join(", ")}) {
          ${fields.join("\n")}
        }
      `;

      const updateResponse = await this.graphQLClient.request<
        Record<string, { returning: GraphQlMediaAssetDownload[] }>
      >(updateRequest, variables);

      Object.values(updateResponse).forEach((update) => {
        update.returning.forEach((download) =>
          appliedUpdates.push(toDomainObject(download)),
        );
      });
    }

    const responseBody: BulkUpdateMediaAssetDownloadsResponse = {
      updates: appliedUpdates,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
