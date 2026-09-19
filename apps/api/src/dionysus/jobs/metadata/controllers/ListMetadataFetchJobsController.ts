import {
  FilterDefinition,
  ListMetadataFetchJobsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
@ApiExtraModels(FilterDefinition)
export class ListMetadataFetchJobsController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Get("/jobs/metadata")
  @ApiOperation({
    summary: "Lists metadata fetch jobs",
    description:
      "Lists metadata fetch jobs.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of certifications fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMetadataFetchJobs",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListMetadataFetchJobsResponse,
    description:
      "The list of metadata fetch jobs.  If there are more jobs to list, a pagination token will be present.",
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
    const { jobs, count } = await this.metadataFetchJobs.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListMetadataFetchJobsResponse = {
      jobs,
      count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
