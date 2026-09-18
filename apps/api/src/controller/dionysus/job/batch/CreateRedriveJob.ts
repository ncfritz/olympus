import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  CreateBatchJobResponse,
  CreateRedriveJobRequest,
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
import { type Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseCreateBatchJobController } from "./BaseCreateBatchJobController";

@Controller({ version: "1" })
export class CreateRedriveJobController extends BaseCreateBatchJobController<CreateRedriveJobRequest> {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient, amqpConnection);
  }

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
    @Res() response: Response,
  ): Promise<void> {
    await this.processRequest(request, response);
  }

  protected buildMessage(
    request: CreateRedriveJobRequest,
    job: BatchJob,
  ): Record<string, unknown> {
    return {
      jobId: job.id,
      jobType: request.metadataType,
      status: request.status,
      targetStatus: request.targetStatus,
      republish: request.publishNotification ?? true,
      offset: 0,
    };
  }

  protected getJobType(_request: CreateRedriveJobRequest): JobType {
    return JobType.REDRIVE;
  }

  protected shouldPublishMessage(
    _request: CreateRedriveJobRequest,
  ): boolean | undefined {
    return true;
  }
}
