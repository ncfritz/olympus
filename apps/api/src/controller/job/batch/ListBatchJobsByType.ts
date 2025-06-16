import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/batch/BatchJobConverter";
import { GraphQlListBatchJobsResponse } from "../../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import {
  BatchJob,
  JobType,
  ListBatchJobsByTypeResponse,
  SortDirection,
} from "@ncfritz/olympus-model";

type GraphQlListBatchJobsByTypeInput = {
  type: JobType;
};

@Controller()
export class ListBatchJobsByTypeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/jobs/batch/:jobType")
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
  })
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
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListBatchJobs($type: String) {
      dionysus_bulk_load_jobs(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}, where: {type: {_eq: $type}}) {
        id
        type
        status
        createdTime
        lastUpdatedTime
        startedTime
        finishedTime
        totalRecords
        duplicateRecords
        noOpRecords
        newRecords
        expiredRecords
        skippedRecords
        processedRecords
      }
    }
    `;

    const fetchResponse = await this.graphQLClient.request<
      GraphQlListBatchJobsResponse,
      GraphQlListBatchJobsByTypeInput
    >(fetchRequest, {
      type: type,
    });
    const fetchedJobs: BatchJob[] = [];

    fetchResponse.dionysus_bulk_load_jobs.forEach((result) => {
      fetchedJobs.push(toDomainObject(result));
    });

    const responseBody: ListBatchJobsByTypeResponse = {
      jobs: fetchedJobs,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
