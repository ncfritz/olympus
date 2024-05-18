import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { BatchJob, DescribeBatchJobResponse } from "@ncfritz/olympus-model";
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
import { toDomainObject } from "../../../convert/batch/BatchJobConverter";
import { GraphQlBatchJob } from "../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetBatchJobResponse = {
  dionysus_bulk_load_jobs_by_pk: GraphQlBatchJob;
};

@Controller()
export class DescribeBatchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/job/batch/:jobId")
  @ApiOperation({
    summary: "Describes an existing batch job",
    description: "Retrieves the details of a batch job.",
    operationId: "DescriberBatchJob",
  })
  @ApiTags("Batch")
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchBatchJob($id: uuid!) {
        dionysus_bulk_load_jobs_by_pk(id: $id) {
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

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetBatchJobResponse>(
        fetchRequest,
        {
          id: jobId,
        },
      );

    if (!fetchResponse.dionysus_bulk_load_jobs_by_pk) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    const fetchedJob: BatchJob = toDomainObject(
      fetchResponse.dionysus_bulk_load_jobs_by_pk,
    );

    const responseBody: DescribeBatchJobResponse = {
      job: fetchedJob,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
