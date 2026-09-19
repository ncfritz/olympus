import {
  ListMediaAssetWorkflowsResponse,
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
export class ListMediaAssetWorkflowsController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Get("/media/workflows")
  @ApiOperation({
    summary: "Lists media asset workflows",
    description:
      "Lists media asset workflows.  By default this API will nly return the latest 30 workflows.",
    operationId: "ListMediaAssetWorkflows",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListMediaAssetWorkflowsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const responseBody: ListMediaAssetWorkflowsResponse =
      await this.workflows.list(
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
