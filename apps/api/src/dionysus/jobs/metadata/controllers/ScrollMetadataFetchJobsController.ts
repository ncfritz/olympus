import { ListMetadataFetchJobsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class ScrollMetadataFetchJobsController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Get("/jobs/metadata/scroll")
  @ApiOperation({
    summary:
      "Scrolls metadata fetch jobs using the last seen ID for pagination",
    description:
      "Lists metadata fetch jobs.  This API orders the job lexicographically by ID to implement scroll capabilities." +
      "The last seen ID can be passed in as an optional parameter, in which case the API will return the next page of" +
      "results where the IDs are greater than the supplied ID.",
    operationId: "ScrollMetadataFetchJobs",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "lastSeenId",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "pageSize",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    type: ListMetadataFetchJobsResponse,
    description:
      "The list of metadata fetch jobs.  If there are more jobs to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("filters") filters: string | undefined,
    @Query("pageSize", new DefaultValuePipe(100), ParseIntPipe)
    pageSize: number,
    @Query("lastSeenId") lastSeenId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { jobs, count } = await this.metadataFetchJobs.scroll(
      filters,
      pageSize,
      lastSeenId,
    );

    const responseBody: ListMetadataFetchJobsResponse = {
      jobs,
      count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
