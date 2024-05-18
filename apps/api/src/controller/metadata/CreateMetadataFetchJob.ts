import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  MetadataFetchJobStatus,
  CreateMetadataFetchJobRequest,
  CreateMetadataFetchJobResponse,
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
import { toDomainObject } from "../../convert/metadata/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateMetadataFetchJobRespons = {
  insert_dionysus_metadata_fetch_status_one: GraphQlMetadataFetchJob;
};

@Controller()
export class CreateMetadataFetchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/v1/metadata/fetchJobs")
  @ApiOperation({
    summary: "Creates a new metadata fetch job",
    description:
      "Creates a new job to fetch metadata for a TMBD entity.  This API will create a new job entity to track progress and enqueue a request to be " +
      "processed asynchronously.",
    operationId: "CreateMetadataFetchJob",
  })
  @ApiTags("Metadata")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMetadataFetchJobRequest,
    required: true,
    description: "Input for the CreateMetadataFetchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateMetadataFetchJobResponse,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMetadataFetchJobRequest,
    @Res() response: Response,
  ): Promise<void> {
    const ttl = request.ttl ? request.ttl : 30;
    const jitter = request.jitter
      ? request.jitter
      : Math.floor(Math.random() * 3 * 24 * 60); // 3 days

    const insertRequest = gql`
      mutation CreateMetadataFetchJob(
        $id: String
        $type: String
        $status: String
        $ttl: numeric
        $jitter: numeric
        $lastFetchedTime: timestamptz
      ) {
        insert_dionysus_metadata_fetch_status_one(
          object: {
            id: $id
            type: $type
            status: $status
            ttl: $ttl
            jitter: $jitter
            lastFetchedTime: $lastFetchedTime
          }
          on_conflict: {
            constraint: metadata_locks_pkey
            update_columns: [status, ttl, jitter, lastFetchedTime]
          }
        ) {
          id
          type
          status
          createdTime
          lastUpdatedTime
          lastFetchedTime
          ttl
          jitter
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataFetchJobRespons>(
        insertRequest,
        {
          id: request.id,
          type: request.type,
          status: request.status || MetadataFetchJobStatus.QUEUED,
          lastFetchedTime: request.lastFetchedTime,
          ttl: ttl,
          jitter: jitter,
        },
      );

    const createdJob: MetadataFetchJob = toDomainObject(
      insertResponse.insert_dionysus_metadata_fetch_status_one,
    );

    if (request.publishNotification) {
      this.amqpConnection.publish(
        "metadataJob.trigger",
        `jobType.${createdJob.type}`,
        {
          entityId: createdJob.id,
          entityType: createdJob.type,
        },
      );
    }

    const responseBody: CreateMetadataFetchJobResponse = {
      job: createdJob,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/fetchJob/${encodeURIComponent(
          createdJob.id,
        )}/${createdJob.type}`,
      )
      .send(responseBody);
  }
}
