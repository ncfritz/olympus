import {
  UpdateContentIngestionWorkflowStepRequest,
  UpdateContentIngestionWorkflowStepResponse,
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
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlContentIngestionWorkflowStep } from "../../../../types/dionysus/content/workflow";
import { toDomainObject } from "../../../../convert/dionysus/content/workflow/ContentIngestionWorkflowStepConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentIngestionWorkflowController } from "./BaseContentIngestionWorkflowController";

type GraphQlUpdateContentIngestionWorkflowStepResponse = {
  update_dionysus_content_asset_ingest_workflow_steps_by_pk: GraphQlContentIngestionWorkflowStep;
};

@Controller({ version: "1" })
export class UpdateContentIngestionWorkflowStepController extends BaseContentIngestionWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Put("/content/workflow/:workflowId/steps/:workflowStepId")
  @ApiOperation({
    summary: "Updates an existing content ingestion workflow step",
    description: "Description",
    operationId: "UpdateContentIngestionWorkflowStep",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateContentIngestionWorkflowStepRequest,
    description: "Input for the UpdateContentIngestionWorkflowStep operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiParam({
    name: "workflowStepId",
    description: "The ID of the workflow step to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentIngestionWorkflowStepResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Body() request: UpdateContentIngestionWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifyWorkflowExists(workflowId);
    await this.verifyWorkflowStepExists(workflowId, workflowStepId);

    const updateRequest = gql`
      mutation UpdateWorkflow(
        $id: uuid!
        $workflowId: uuid!
        $changes: dionysus_content_asset_ingest_workflow_steps_set_input = {}
      ) {
        update_dionysus_content_asset_ingest_workflow_steps_by_pk(
          pk_columns: { id: $id, workflow_id: $workflowId }
          _set: $changes
        ) {
          id
          type
          status
          progress
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentIngestionWorkflowStepResponse>(
        updateRequest,
        {
          id: workflowStepId,
          workflowId: workflowId,
          changes: request.step,
        },
      );

    const updatedWorkflowStep = toDomainObject(
      updateResponse.update_dionysus_content_asset_ingest_workflow_steps_by_pk,
    );

    const responseBody: UpdateContentIngestionWorkflowStepResponse = {
      step: updatedWorkflowStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
