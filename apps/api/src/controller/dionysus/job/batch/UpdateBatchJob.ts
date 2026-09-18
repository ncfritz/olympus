import {
  BatchJob,
  JobStatus,
  UpdateBatchJobRequest,
  UpdateBatchJobResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  NotFoundException,
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
import moment from "moment";
import { toDomainObject } from "../../../../convert/dionysus/job/BatchJobConverter";
import { GraphQlBatchJob } from "../../../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlUpdateMetadataFetchJobResponse = {
  update_dionysus_bulk_load_jobs_by_pk: GraphQlBatchJob | null;
};

@Controller({ version: "1" })
export class UpdateBatchJobController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/job/batch/:jobId")
  @ApiOperation({
    summary: "Updates an existing batch job",
    description: "Applies the given changes to a batch job.",
    operationId: "UpdateBatchJob",
    tags: ["Batch"],
  })
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
    @Body() request: UpdateBatchJobRequest,
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

    const updates = request.job;

    if (
      updates.status &&
      [JobStatus.CANCELLED, JobStatus.FAILED, JobStatus.SUCCESS].includes(
        updates.status,
      ) &&
      !updates.finishedTime
    ) {
      updates.finishedTime = moment().utc();
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataFetchJobResponse>(
        updateRequest,
        {
          id: jobId,
          changes: updates,
        },
      );

    if (!updateResponse.update_dionysus_bulk_load_jobs_by_pk) {
      throw new NotFoundException();
    }

    const updatedJob: BatchJob = toDomainObject(
      updateResponse.update_dionysus_bulk_load_jobs_by_pk,
    );

    const responseBody: UpdateBatchJobResponse = {
      job: updatedJob,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
