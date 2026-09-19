import {
  ListMediaAssetTranscodesResponse,
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
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class ListMediaAssetTranscodesController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Get("/media/transcodes")
  @ApiOperation({
    summary: "Lists media transcodes",
    description: "Lists media transcodes.",
    operationId: "ListMediaAssetTranscodes",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of transcodes.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetTranscodesResponse,
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
    const userFilters = parseFilterDefinition(filters);
    const responseBody: ListMediaAssetTranscodesResponse =
      await this.workflows.listTranscodes(
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
