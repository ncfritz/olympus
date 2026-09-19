import {
  ListMediaAssetSearchExecutionsResponse,
  MediaAssetSearchType,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { MediaAssetSearchExecutionService } from "../services/MediaAssetSearchExecutionService";

@Controller({ version: "1" })
export class ListMediaAssetSearchExecutionsController {
  constructor(
    private readonly searchExecutions: MediaAssetSearchExecutionService,
  ) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/executions")
  @ApiOperation({
    summary: "Lists search executions for a search configuration",
    description:
      "Lists the search executions for the specified search configuration.  By default this API will nly return" +
      "the last 30 entries.",
    operationId: "ListMediaAssetSearchExecutions",
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
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of search executions.  If there are more executions to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchExecutionsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "startedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const responseBody: ListMediaAssetSearchExecutionsResponse =
      await this.searchExecutions.list(
        mediaType,
        mediaId,
        {
          pageSize: pageSize,
          startPage: startPage,
          sortDirection: sortDirection,
          sortField: sortField,
        },
        userFilters,
      );

    response.status(HttpStatus.OK).send(responseBody);
  }
}
