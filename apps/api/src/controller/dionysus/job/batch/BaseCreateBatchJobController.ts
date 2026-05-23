import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  BatchJob,
  CreateBatchJobResponse,
  JobType,
} from "@ncfritz/olympus-model";
import { Body, HttpStatus, Res } from "@nestjs/common";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/job/BatchJobConverter";
import { GraphQlBatchJob } from "../../../../types/batchJobs";

type GraphQlCreateBatchJobResponse = {
  insert_dionysus_bulk_load_jobs_one: GraphQlBatchJob;
};

export abstract class BaseCreateBatchJobController<I> {
  protected readonly graphQLClient: GraphQLClient;
  protected readonly amqpConnection: AmqpConnection;

  protected constructor(
    graphQLClient: GraphQLClient,
    amqpConnection: AmqpConnection,
  ) {
    this.graphQLClient = graphQLClient;
    this.amqpConnection = amqpConnection;
  }

  protected abstract getJobType(request: I): JobType;
  protected abstract shouldPublishMessage(request: I): boolean | undefined;
  protected abstract buildMessage(request: I, job: BatchJob): any;

  async processRequest(
    @Body() request: I,
    @Res() response: Response,
  ): Promise<void> {
    const type = this.getJobType(request);

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
          maxRecordsToProcess
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateBatchJobResponse>(
        insertRequest,
        {
          type: type,
        },
      );

    const createdJob: BatchJob = toDomainObject(
      insertResponse.insert_dionysus_bulk_load_jobs_one,
    );

    if (this.shouldPublishMessage(request)) {
      const message = this.buildMessage(request, createdJob);

      await this.amqpConnection.publish(
        "batchJob.trigger",
        `jobType.${type}`,
        message,
      );
    }

    const responseBody: CreateBatchJobResponse = {
      job: createdJob,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/job/batch/${createdJob.id}`,
      )
      .send(responseBody);
  }
}
