import {
  CreateBatchJobResponse,
  CreateRedriveJobRequest,
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
export class CreateRedriveJobController {
  constructor(private readonly batchJobs: BatchJobService) {}

  @Post("/jobs/batch/redrive")
  @ApiOperation({
    summary: "Creates a new redrive batch job",
    description:
      "Creates a batch job that republishes metadata fetch jobs in a given status for reprocessing.",
    operationId: "CreateRedriveJob",
    tags: ["Batch"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateRedriveJobRequest,
    required: true,
    description: "Input for the CreateRedriveJob operation",
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
    @Body() request: CreateRedriveJobRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const job = await this.batchJobs.createRedrive(request);
    const responseBody: CreateBatchJobResponse = {
      job,
    };

    setLocation(response, httpRequest, DescribeBatchJobController, {
      jobId: job.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
