import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  BatchJob,
  PartialBatchJob,
  UpdateBatchJobRequest,
  UpdateBatchJobResponse,
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
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/batch/BatchJobConverter";
import { GraphQlBatchJob } from "../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateMEtadataFetchJobresponse = {
  update_dionysus_bulk_load_jobs_by_pk: GraphQlBatchJob;
};

@Controller()
export class UpdateBatchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Put("/v1/job/batch/:jobId")
  @ApiOperation({
    summary: "Updates an existing batch job",
    description: "Description",
    operationId: "DescriberJob",
  })
  @ApiTags("Batch")
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateBatchJobRequest,
    description: "Input for the UpdateBatchJob operation",
  })
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateBatchJobResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("jobId") jobId: string,
    @Body() request: Partial<PartialBatchJob>,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateBatchJob(
        $id: uuid!
        $changes: dionysus_bulk_load_jobs_set_input = {}
      ) {
        update_dionysus_bulk_load_jobs_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
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

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMEtadataFetchJobresponse>(
        updateRequest,
        {
          id: jobId,
          changes: request,
        },
      );

    const updatedJob: BatchJob = toDomainObject(
      updateResponse.update_dionysus_bulk_load_jobs_by_pk,
    );

    const responseBody: UpdateBatchJobResponse = {
      job: updatedJob,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
