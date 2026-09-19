import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  CreateBatchJobRequest,
  CreateBatchJobResponse,
  JobType,
} from "@ncfritz/olympus-model";
import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseCreateBatchJobController } from "./BaseCreateBatchJobController";

@Controller({ version: "1" })
export class CreateBatchJobController extends BaseCreateBatchJobController<CreateBatchJobRequest> {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient, amqpConnection);
  }

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
    await this.processRequest(request, httpRequest, response);
  }

  protected buildMessage(
    request: CreateBatchJobRequest,
    job: BatchJob,
  ): Record<string, unknown> {
    return {
      jobType: job.type,
      jobId: job.id,
      offset: request.offset,
      max: request.maxRecordsToProcess,
    };
  }

  protected getJobType(request: CreateBatchJobRequest): JobType {
    return request.type;
  }

  protected shouldPublishMessage(
    request: CreateBatchJobRequest,
  ): boolean | undefined {
    return request.publishNotification ?? true;
  }
}
