import { GetBatchJobStatsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";

import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BatchJobService } from "../services/BatchJobService";

@Controller({ version: "1" })
export class GetBatchJobStatsController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Get("/jobs/batch/stats")
  @ApiOperation({
    summary: "Gets stats for Dionysus batch jobs",
    description:
      "Gets the last 90 days worth of Dionysus batch job executions.  This API only returns the " +
      "execution status of the jobs.  For actual execution statistics, callers should use the " +
      "GetBatchJobStatsByType API.",
    operationId: "GetBatchJobStats",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "Request completed successfully.",
    type: GetBatchJobStatsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetBatchJobStatsResponse =
      await this.batchJobs.getStatistics();

    response.status(HttpStatus.OK).send(responseBody);
  }
}
