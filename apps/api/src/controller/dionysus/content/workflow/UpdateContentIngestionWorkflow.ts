import {
  ContentIngestionWorkflowStatus,
  UpdateContentIngestionWorkflowRequest,
  UpdateContentIngestionWorkflowResponse,
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
import moment from "moment";
import { GraphQLContentIngestionWorkflow } from "../../../../types/dionysus/content/workflow";
import { toDomainObject } from "../../../../convert/dionysus/content/workflow/ContentIngestionWorkflowConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlUpdateContentIngestionWorkflowResponse = {
  update_dionysus_content_asset_ingest_workflows_by_pk: GraphQLContentIngestionWorkflow;
};

@Controller({ version: "1" })
export class UpdateContentIngestionWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/content/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing content ingestion workflow",
    description: "Applies the given changes to a content ingestion workflow.",
    operationId: "UpdateContentIngestionWorkflow",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateContentIngestionWorkflowRequest,
    description: "Input for the UpdateContentIngestionWorkflow operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentIngestionWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateContentIngestionWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateWorkflow(
        $id: uuid!
        $changes: dionysus_content_asset_ingest_workflows_set_input = {}
      ) {
        update_dionysus_content_asset_ingest_workflows_by_pk(
          pk_columns: { id: $id }
          _set: $changes
        ) {
          id
          source
          sourceType
          tempLocation
          status
          startedTime
          finishedTime
          createdTime
          lastUpdatedTime
          steps {
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
      }
    `;

    const updates = request.workflow;

    if (
      updates.status &&
      [
        ContentIngestionWorkflowStatus.SKIPPED,
        ContentIngestionWorkflowStatus.FAILED,
        ContentIngestionWorkflowStatus.SUCCESS,
      ].includes(updates.status) &&
      !updates.finishedTime
    ) {
      updates.finishedTime = moment().utc();
    }

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateContentIngestionWorkflowResponse>(
        updateRequest,
        {
          id: workflowId,
          changes: updates,
        },
      );

    const updatedWorkflow = toDomainObject(
      updateResponse.update_dionysus_content_asset_ingest_workflows_by_pk,
    );

    const responseBody: UpdateContentIngestionWorkflowResponse = {
      workflow: updatedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
