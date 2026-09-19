import { DescribeBatchJobResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BatchJobService } from "../services/BatchJobService";

@Controller({ version: "1" })
export class DescribeBatchJobController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Get("/job/batch/:jobId")
  @ApiOperation({
    summary: "Describes an existing batch job",
    description: "Retrieves the details of a batch job.",
    operationId: "DescribeBatchJob",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: DescribeBatchJobResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeBatchJobResponse = {
      job: await this.batchJobs.describe(jobId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
