import {
  UpdateWorkflowRequest,
  UpdateWorkflowResponse,
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
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowConverter";
import { GraphQLWorkflow } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateMetadataWorkflowResponse = {
  update_dionysus_metadata_workflow_by_pk: GraphQLWorkflow;
};

@Controller({ version: "1" })
export class UpdateWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing metadata workflow",
    description: "Description",
    operationId: "UpdateMetadataWorkflow",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateWorkflowRequest,
    description: "Input for the UpdateBatchJob operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateWorkflow(
        $id: uuid!
        $changes: dionysus_metadata_workflow_set_input = {}
      ) {
        update_dionysus_metadata_workflow_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          startedTime
          status
          steps {
            attempt
            createdTime
            id
            lastUpdatedTime
            type
            job {
              createdTime
              duplicateRecords
              expiredRecords
              finishedTime
              id
              lastUpdatedTime
              maxRecordsToProcess
              newRecords
              noOpRecords
              processedRecords
              skippedRecords
              startedTime
              status
              totalRecords
              type
            }
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateMetadataWorkflowResponse>(
        updateRequest,
        {
          id: workflowId,
          changes: request.workflow,
        },
      );

    const updatedWorkflow = toDomainObject(
      updateResponse.update_dionysus_metadata_workflow_by_pk,
    );

    const responseBody: UpdateWorkflowResponse = {
      workflow: updatedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
