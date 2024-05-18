import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  MetadataFetchJob,
  DescribeMetadataFetchJobResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/MetadataFetchJobConverter";
import { GraphQlMetadataFetchJob } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGetMetadataFetchJobResponse = {
  dionysus_metadata_fetch_status_by_pk: GraphQlMetadataFetchJob;
};

@Controller()
export class DescribeMetadataFetchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Describes an existing metadate fetch job",
    description: "Retrieves the details of a metadata fetch job.",
    operationId: "DescribeMetadataFetchJob",
  })
  @ApiTags("Metadata")
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
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: string,
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
      response.status(HttpStatus.NOT_FOUND).end();
      return;
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
