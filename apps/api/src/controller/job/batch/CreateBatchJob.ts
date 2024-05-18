import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  CreateBatchJobRequest,
  CreateBatchJobResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/batch/BatchJobConverter";
import { GraphQlBatchJob } from "../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlCreateBatchJobResponse = {
  insert_dionysus_bulk_load_jobs_one: GraphQlBatchJob;
};

@Controller()
export class CreateBatchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/v1/jobs/batch")
  @ApiOperation({
    summary: "Creates a new batch job",
    description:
      "Creates a new batch processing job to download TMDB's nightly ID files for processing.  " +
      "This API will create a new job entity to track progress and enqueue a request to be " +
      "processed asynchronously.",
    operationId: "CreateBatchJob",
  })
  @ApiTags("Batch")
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
    const insertRequest = gql`
      mutation CreateBatchJob($type: String) {
        insert_dionysus_bulk_load_jobs_one(object: { type: $type }) {
          id
          type
          status
          createdTime
          lastUpdatedTime
          startedTime
          finishedTime
          totalRecords
          processedRecords
          duplicateRecords
          noOpRecords
          newRecords
          expiredRecords
          skippedRecords
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateBatchJobResponse>(
        insertRequest,
        {
          type: request.type,
        },
      );

    const createdJob: BatchJob = toDomainObject(
      insertResponse.insert_dionysus_bulk_load_jobs_one,
    );

    if (request.publishNotification) {
      this.amqpConnection.publish(
        "batchJob.trigger",
        `jobType.${request.type}`,
        {
          type: createdJob.type,
          jobId: createdJob.id,
          offset: request.offset,
        },
      );
    }

    const responseBody: CreateBatchJobResponse = {
      job: createdJob,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/job/batch/${createdJob.id}`,
      )
      .send(responseBody);
  }
}
