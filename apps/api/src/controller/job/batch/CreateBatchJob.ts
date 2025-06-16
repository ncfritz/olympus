import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  CreateBatchJobRequest,
  CreateBatchJobResponse,
  JobType,
} from "@ncfritz/olympus-model";
import { Body, Controller, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseCreateBatchJobController } from "./BaseCreateBatchJobController";

@Controller()
export class CreateBatchJobController extends BaseCreateBatchJobController<CreateBatchJobRequest> {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient, amqpConnection);
  }

  @Post("/v1/jobs/batch")
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
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateBatchJobRequest,
    @Res() response: Response,
  ): Promise<void> {
    console.log(request);
    await this.processRequest(request, response);
  }

  protected buildMessage(request: CreateBatchJobRequest, job: BatchJob): any {
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
    return request.publishNotification;
  }
}
