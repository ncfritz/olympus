import {
  MetadataFetchJob,
  DeleteMetadataFetchJobResponse,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlDeleteMetadataFetchJobRespons = {
  delete_dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

@Controller({ version: "1" })
export class DeleteMetadataFetchJobController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Deleted an existing metadate fetch job",
    description: "Deletes the specified fetch job.",
    operationId: "DeleteMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to delete",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "entityType",
    description: "The type the job to delete",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
  })
  @ApiNoContentResponse({
    description: "The record has been successfully deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: string,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteFetchJob($id: String!, $type: String!) {
        delete_dionysus_metadata_fetch_status_by_pk(id: $id, type: $type) {
          createdTime
          id
          jitter
          lastFetchedTime
          lastUpdatedTime
          status
          ttl
          type
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlDeleteMetadataFetchJobRespons>(
        deleteRequest,
        {
          id: entityId,
          type: entityType,
        },
      );

    if (!fetchResponse.delete_dionysus_metadata_fetch_status_by_pk) {
      throw new NotFoundException();
    }

    const deletedJob: MetadataFetchJob = toDomainObject(
      fetchResponse.delete_dionysus_metadata_fetch_status_by_pk,
    );

    const responseBody: DeleteMetadataFetchJobResponse = {
      job: deletedJob,
    };

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
