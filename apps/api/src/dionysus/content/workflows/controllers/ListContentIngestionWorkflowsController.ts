import {
  ListContentIngestionWorkflowsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { ContentIngestionWorkflowService } from "../services/ContentIngestionWorkflowService";

@Controller({ version: "1" })
export class ListContentIngestionWorkflowsController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

  @Get("/content/workflows")
  @ApiOperation({
    summary: "Lists content ingestion workflows",
    description:
      "Lists content ingestion workflows.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of workflows fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentIngestionWorkflows",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListContentIngestionWorkflowsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListContentIngestionWorkflowsResponse =
      await this.contentIngestionWorkflows.list(filters, {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      });

    response.status(HttpStatus.OK).send(responseBody);
  }
}
