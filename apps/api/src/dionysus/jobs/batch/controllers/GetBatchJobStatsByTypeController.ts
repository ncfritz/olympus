import {
  GetBatchJobStatsByTypeResponse,
  JobType,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";

import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BatchJobService } from "../services/BatchJobService";

@Controller({ version: "1" })
export class GetBatchJobStatsByTypeController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Get("/jobs/batch/:jobType/stats")
  @ApiOperation({
    summary: "Gets stats for a specific batch job type",
    description:
      "Gets the last 90 days work of execution and performance stats for a batch job type.",
    operationId: "GetBatchJobStatsByType",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobType",
    description: "The type of batch job to get statistics for.",
    enum: JobType,
    enumName: "JobType",
    enumSchema: { description: "The type of a batch job" },
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: GetBatchJobStatsByTypeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobType") type: JobType,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetBatchJobStatsByTypeResponse =
      await this.batchJobs.getStatisticsByType(type);

    response.status(HttpStatus.OK).json(responseBody);
  }
}
