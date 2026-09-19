import {
  CreateBatchJobRequest,
  CreateBatchJobResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BatchJobService } from "../services/BatchJobService";
import { setLocation } from "../../../../utils/location";
import { DescribeBatchJobController } from "./DescribeBatchJobController";

@Controller({ version: "1" })
export class CreateBatchJobController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Post("/jobs/batch")
  @ApiOperation({
    summary: "Creates a new batch job",
    description:
      "Creates a new batch processing job to download TMDB's nightly ID files for processing.  " +
      "This API will create a new job entity to track progress and enqueue a request to be " +
      "processed asynchronously.",
    operationId: "CreateBatchJob",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateBatchJobRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateBatchJobResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateBatchJobRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const job = await this.batchJobs.create(request);
    const responseBody: CreateBatchJobResponse = {
      job,
    };

    setLocation(response, httpRequest, DescribeBatchJobController, {
      jobId: job.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
