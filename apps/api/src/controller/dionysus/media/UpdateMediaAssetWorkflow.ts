import {
  SingleMediaAssetWorkflowResponse,
  UpdateMediaAssetWorkflowRequest,
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
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowConverter";
import { DECORATED_MEDIA_ASSET_WORKFLOW } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflow } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateChildMediaAssetWorkflowResponse = {
  update_dionysus_media_asset_workflow_by_pk: GraphQlDecoratedMediaAssetWorkflow;
};

@Controller({ version: "1" })
export class UpdateMediaAssetWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing media workflow",
    description: "Updates an existing media workflow.",
    operationId: "UpdateMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetWorkflowRequest,
    description: "Input for the UpdateMediaAssetWorkflow operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow.",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateMediaAssetWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const updateRequest = gql`
      mutation UpdateMediaAssetWorkflow(
        $workflowId: uuid!
        $changes: dionysus_media_asset_workflow_set_input = {}
      ) {
        update_dionysus_media_asset_workflow_by_pk(
          pk_columns: { id: $workflowId }
          _set: $changes
        ) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateChildMediaAssetWorkflowResponse>(
        updateRequest,
        {
          workflowId: workflowId,
          changes: request.workflow,
        },
      );

    const updatedWorkflow = toDecoratedDomainObject(
      updateResponse.update_dionysus_media_asset_workflow_by_pk,
    );

    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: updatedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
