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
import { toDomainObject } from "../../../../convert/dionysus/job/BatchJobConverter";
import { GraphQlListBatchJobsResponse } from "../../../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

@Controller({ version: "1" })
export class ListBatchJobsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/jobs/batch")
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
    name: "filters",
    type: String,
    required: false,
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
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListBatchJobs {
      dionysus_bulk_load_jobs(${[paginationExpression, whereExpression].join(", ")}) {
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
      dionysus_bulk_load_jobs_aggregate${whereExpression ? `(${whereExpression})` : ""} {
        aggregate {
          count
        }
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
      count: fetchResponse.dionysus_bulk_load_jobs_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
