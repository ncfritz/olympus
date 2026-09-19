import {
  ListMediaAssetSearchResultsResponse,
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
import { MediaAssetSearchResultService } from "../services/MediaAssetSearchResultService";

@Controller({ version: "1" })
export class ListMediaAssetSearchResultsController {
  constructor(private readonly searchResults: MediaAssetSearchResultService) {}

  @Get("/media/searchConfiguration/:mediaType/:mediaId/results")
  @ApiOperation({
    summary: "Lists search results for a search configuration",
    description:
      "Lists the search results for the specified search configuration.",
    operationId: "ListMediaAssetSearchResults",
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
      "The list of search results.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetSearchResultsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "postedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const responseBody: ListMediaAssetSearchResultsResponse =
      await this.searchResults.list(
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
