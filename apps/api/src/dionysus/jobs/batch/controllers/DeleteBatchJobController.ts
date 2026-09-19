import { DeleteBatchJobResponse } from "@ncfritz/olympus-model";
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class DeleteBatchJobController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/job/batch/:jobId")
  @ApiOperation({
    summary: "Deletes an existing job",
    description:
      "Removes an existing execution of a batch job.  This will also remove any existing logs " +
      "and other associated artifacts with the job.  This will not remove or cancel any downstream jobs or " +
      "artifacts created or updated by downstream jobs.",
    operationId: "DeleteBatchJob",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiNoContentResponse({
    description: "The record has been successfully deleted.",
    type: DeleteBatchJobResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ): Promise<void> {
    const deleteRequest = gql`
      mutation DeleteBatchJob($id: uuid!) {
        delete_dionysus_bulk_load_jobs_by_pk(id: $id) {
          id
        }
      }
    `;

    const deleteResponse = await this.graphQLClient.request<{
      delete_dionysus_bulk_load_jobs_by_pk: { id: string } | null;
    }>(deleteRequest, {
      id: jobId,
    });

    if (!deleteResponse.delete_dionysus_bulk_load_jobs_by_pk) {
      throw new NotFoundException();
    }

    const responseBody: DeleteBatchJobResponse = {};

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
