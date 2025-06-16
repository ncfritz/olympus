import {
  BatchJob,
  ListBatchJobsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/batch/BatchJobConverter";
import { GraphQlListBatchJobsResponse } from "../../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";

@Controller()
export class ListBatchJobsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/jobs/batch")
  @ApiOperation({
    summary: "Lists batch jobs",
    description:
      "Lists batch jobs.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of jobs fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListBatchJobs",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of jobs.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListBatchJobsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListBatchJobs {
      dionysus_bulk_load_jobs(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}) {
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

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListBatchJobsResponse>(
        fetchRequest,
      );
    const fetchedJobs: BatchJob[] = [];

    fetchResponse.dionysus_bulk_load_jobs.forEach((result) => {
      fetchedJobs.push(toDomainObject(result));
    });

    const responseBody: ListBatchJobsResponse = {
      jobs: fetchedJobs,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
