import {
  JobType,
  ListBatchJobsByTypeResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
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
import { BatchJobService } from "../services/BatchJobService";

@Controller({ version: "1" })
export class ListBatchJobsByTypeController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Get("/jobs/batch/:jobType")
  @ApiOperation({
    summary: "Lists batch jobs by job type",
    description:
      "Lists batch jobs by type.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of jobs fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListBatchJobsByType",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobType",
    description: "The type of batch job to get statistics for.",
    enum: JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListBatchJobsByTypeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobType") type: JobType,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { jobs, count } = await this.batchJobs.listByType(
      type,
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListBatchJobsByTypeResponse = {
      jobs,
      count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
