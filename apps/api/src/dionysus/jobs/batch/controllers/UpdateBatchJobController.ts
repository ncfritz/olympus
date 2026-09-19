import {
  UpdateBatchJobRequest,
  UpdateBatchJobResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
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
export class UpdateBatchJobController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Put("/job/batch/:jobId")
  @ApiOperation({
    summary: "Updates an existing batch job",
    description: "Applies the given changes to a batch job.",
    operationId: "UpdateBatchJob",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateBatchJobRequest,
    description: "Input for the UpdateBatchJob operation",
  })
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateBatchJobResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("jobId") jobId: string,
    @Body() request: UpdateBatchJobRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateBatchJobResponse = {
      job: await this.batchJobs.update(jobId, request.job),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
