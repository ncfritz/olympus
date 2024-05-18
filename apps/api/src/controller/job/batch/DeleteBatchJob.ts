import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { DeleteBatchJobResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller()
export class DeleteBatchJobController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Delete("/v1/job/batch/:jobId")
  @ApiOperation({
    summary: "Deletes an existing job",
    description:
      "Removes an existing execution of a batch job.  This will also remove any existing logs " +
      "and other associated artifacts with the job.  This will not remove or cancel any downstream jobs or " +
      "artifacts created or updated by downstream jobs.",
    operationId: "DeleteBatchJob",
  })
  @ApiTags("Batch")
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
      mutation DeleteBatchJob($job_id: uuid!) {
        delete_dionysus_bulk_load_jobs_by_pk(id: $id) {
          id
        }
      }
    `;

    const deleteResponse = await this.graphQLClient.request(deleteRequest, {
      id: jobId,
    });

    if (!deleteResponse) {
      /*nothing*/
    }

    const responseBody: DeleteBatchJobResponse = {};

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
