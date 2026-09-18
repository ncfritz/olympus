import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  MetadataFetchJobStatus,
  MetadataJobType,
  UpdateMetadataFetchJobRequest,
  UpdateMetadataFetchJobResponse,
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
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/job/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlUpdateMetadataFetchJobResponse = {
  update_dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

@Controller({ version: "1" })
export class UpdateMetadataFetchJobController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Put("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Updates an existing metadata fetch job",
    description:
      "Applies the given changes to a metadata fetch job. If the job ends up queued and `publishNotification` is set, a fetch message is published.",
    operationId: "UpdateMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMetadataFetchJobRequest,
    description: "Input for the UpdateMetadataFetchJob operation",
  })
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to update",
    type: String,
  })
  @ApiParam({
    name: "entityType",
    description: "The type the job to update",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
  })
  @ApiOkResponse({
    type: UpdateMetadataFetchJobResponse,
    description: "The record has been successfully updated.",
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("entityId") entityId: number,
    @Param("entityType") entityType: MetadataJobType,
    @Body() request: Partial<UpdateMetadataFetchJobRequest>,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateMetadataFetchJob(
        $id: String!
        $type: String!
        $changes: dionysus_metadata_fetch_status_set_input = {}
      ) {
        update_dionysus_metadata_fetch_status_by_pk(
          pk_columns: { id: $id, type: $type }
          _set: $changes
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

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataFetchJobResponse>(
        updateRequest,
        {
          id: entityId,
          type: entityType,
          changes: request.job,
        },
      );

    const updatedJob: MetadataFetchJob = toDomainObject(
      updateResponse.update_dionysus_metadata_fetch_status_by_pk,
    );

    if (
      updatedJob.status === MetadataFetchJobStatus.QUEUED &&
      request.publishNotification
    ) {
      await this.amqpConnection.publish(
        "metadataJob.trigger",
        `jobType.${updatedJob.type}`,
        {
          entityId: updatedJob.id,
          entityType: updatedJob.type,
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

    const responseBody: UpdateMetadataFetchJobResponse = {
      job: updatedJob,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
