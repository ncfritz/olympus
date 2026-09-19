import { ListWorkflowsResponse, SortDirection } from "@ncfritz/olympus-model";
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
} from "../../../utils/controllerDecorators";
import { MetadataWorkflowService } from "../services/MetadataWorkflowService";

@Controller({ version: "1" })
export class ListMetadataWorkflowsController {
  constructor(private readonly metadataWorkflows: MetadataWorkflowService) {}

  @Get("/workflows")
  @ApiOperation({
    summary: "Lists metadata workflows",
    description:
      "Lists metadata workflows.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of workflows fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMetadataWorkflows",
    tags: ["Workflow"],
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
    type: () => ListWorkflowsResponse,
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
    const { workflows, count } = await this.metadataWorkflows.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListWorkflowsResponse = {
      workflows,
      count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
