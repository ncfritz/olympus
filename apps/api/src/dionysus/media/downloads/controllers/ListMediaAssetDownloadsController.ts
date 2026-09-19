import {
  ListMediaAssetDownloadsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { MediaAssetDownloadService } from "../services/MediaAssetDownloadService";

@Controller({ version: "1" })
export class ListMediaAssetDownloadsController {
  constructor(
    private readonly mediaAssetDownloads: MediaAssetDownloadService,
  ) {}

  @Get("/media/downloads")
  @ApiOperation({
    summary: "Lists media downloads",
    description: "Lists media downloads.",
    operationId: "ListMediaAssetDownloads",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of downloads.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetDownloadsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "startedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { downloads, count } = await this.mediaAssetDownloads.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListMediaAssetDownloadsResponse = {
      downloads,
      count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
