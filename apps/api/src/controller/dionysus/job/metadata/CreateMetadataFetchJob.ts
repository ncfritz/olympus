import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  MetadataFetchJobStatus,
  CreateMetadataFetchJobRequest,
  CreateMetadataFetchJobResponse,
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
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/job/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMetadataFetchJobController } from "./DescribeMetadataFetchJob";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateMetadataFetchJobRespons = {
  insert_dionysus_metadata_fetch_status_one: GraphQlMetadataFetchJob;
};

@Controller({ version: "1" })
export class CreateMetadataFetchJobController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/metadata/fetchJobs")
  @ApiOperation({
    summary: "Creates a new metadata fetch job",
    description:
      "Creates a new job to fetch metadata for a TMBD entity.  This API will create a new job entity to track progress and enqueue a request to be " +
      "processed asynchronously.",
    operationId: "CreateMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMetadataFetchJobRequest,
    required: true,
    description: "Input for the CreateMetadataFetchJob operation",
  })
  @ApiCreatedResponse({
    type: CreateMetadataFetchJobResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMetadataFetchJobRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const ttl = request.ttl ?? 30;
    const jitter = request.jitter ?? Math.floor(Math.random() * 3 * 24 * 60); // 3 days

    const insertRequest = gql`
      mutation CreateMetadataFetchJob(
        $id: String
        $type: String
        $status: String
        $ttl: numeric
        $jitter: numeric
        $lastFetchedTime: timestamptz
        $context: String
      ) {
        insert_dionysus_metadata_fetch_status_one(
          object: {
            id: $id
            type: $type
            status: $status
            ttl: $ttl
            jitter: $jitter
            lastFetchedTime: $lastFetchedTime
            context: $context
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
          context
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
          context: request.context
            ? Buffer.from(JSON.stringify(request.context), "utf-8").toString(
                "base64",
              )
            : undefined,
        },
      );

    const createdJob: MetadataFetchJob = toDomainObject(
      insertResponse.insert_dionysus_metadata_fetch_status_one,
    );

    if (request.publishNotification ?? true) {
      await this.amqpConnection.publish(
        "metadataJob.trigger",
        `jobType.${createdJob.type}`,
        {
          entityId: createdJob.id,
          entityType: createdJob.type,
          bypassCache: request.bypassCache,
        },
        {
          persistent: true,
          headers: {
            "x-delay": 10000,
          },
        },
      );
    }

    const responseBody: CreateMetadataFetchJobResponse = {
      job: createdJob,
    };

    setLocation(response, httpRequest, DescribeMetadataFetchJobController, {
      entityId: createdJob.id,
      entityType: createdJob.type,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
