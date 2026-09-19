import {
  BatchJob,
  FilterDefinition,
  FilterType,
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
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/BatchJobConverter";
import { GraphQlListBatchJobsResponse } from "../../types/batchJobs";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
  parseFilterDefinition,
} from "../../../../utils/filterUtil";

@Controller({ version: "1" })
export class ListBatchJobsByTypeController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

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
    const typeFilter: FilterDefinition = {
      type: FilterType.EQUALS,
      name: "type",
      value: type,
    };
    const userFilters = parseFilterDefinition(filters);

    const whereExpression = buildFilterExpression(
      userFilters
        ? {
            type: FilterType.AND,
            name: "_",
            value: [typeFilter, userFilters!],
          }
        : typeFilter,
    );
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListBatchJobsByType {
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

    const responseBody: ListBatchJobsByTypeResponse = {
      jobs: fetchedJobs,
      count: fetchResponse.dionysus_bulk_load_jobs_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
