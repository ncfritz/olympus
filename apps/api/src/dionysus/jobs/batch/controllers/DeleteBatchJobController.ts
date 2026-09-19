import { DeleteBatchJobResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BatchJobService } from "../services/BatchJobService";

@Controller({ version: "1" })
export class DeleteBatchJobController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Delete("/job/batch/:jobId")
  @ApiOperation({
    summary: "Deletes an existing job",
    description:
      "Removes an existing execution of a batch job.  This will also remove any existing logs " +
      "and other associated artifacts with the job.  This will not remove or cancel any downstream jobs or " +
      "artifacts created or updated by downstream jobs.",
    operationId: "DeleteBatchJob",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiNoContentResponse({
    description: "The record has been successfully deleted.",
    type: DeleteBatchJobResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.batchJobs.delete(jobId);

    const responseBody: DeleteBatchJobResponse = {};

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
