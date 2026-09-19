import {
  MetadataFetchJob,
  DescribeMetadataFetchJobResponse,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMetadataFetchJobResponse = {
  dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

@Controller({ version: "1" })
export class DescribeMetadataFetchJobController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Describes an existing metadate fetch job",
    description: "Retrieves the details of a metadata fetch job.",
    operationId: "DescribeMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "entityType",
    description: "The type of the job to describe",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
  })
  @ApiOkResponse({
    type: DescribeMetadataFetchJobResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: MetadataJobType,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchMetadataFetchJob($id: String!, $type: String!) {
        dionysus_metadata_fetch_status_by_pk(id: $id, type: $type) {
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

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataFetchJobResponse>(
        fetchRequest,
        {
          id: entityId,
          type: entityType,
        },
      );

    if (!fetchResponse.dionysus_metadata_fetch_status_by_pk) {
      throw new NotFoundException();
    }

    const fetchedJob: MetadataFetchJob = toDomainObject(
      fetchResponse.dionysus_metadata_fetch_status_by_pk,
    );

    const responseBody: DescribeMetadataFetchJobResponse = {
      job: fetchedJob,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
