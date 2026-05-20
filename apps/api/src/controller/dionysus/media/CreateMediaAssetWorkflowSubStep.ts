import {
  MediaAssetWorkflowStepStatus,
  CreateMediaAssetWorkflowSubStepRequest,
  CreateMediaAssetWorkflowSubStepResponse,
  MediaAssetWorkflowSubStep,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toSubStepDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { BASE_MEDIA_ASSET_WORKFLOW_STEP } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlMediaAssetWorkflowSubStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";

type GraphQlCreateMediaAssetWorkflowSubStepResponse = {
  insert_dionysus_media_asset_workflow_step_one: GraphQlMediaAssetWorkflowSubStep;
};

@Controller({ version: "1" })
export class CreateMediaAssetWorkflowSubStepController extends BaseMediaAssetWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/media/workflow/:workflowId/step/:workflowStepId/subSteps")
  @ApiOperation({
    summary: "Creates a new media asset workflow sub step",
    description: "Creates a new media asset workflow sub step.",
    operationId: "CreateMediaAssetWorkflowSubStep",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to add the step to",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "workflowStepId",
    description: "The ID of the workflow step to add the sub step to",
    type: String,
    required: true,
  })
  @ApiBody({
    type: CreateMediaAssetWorkflowSubStepRequest,
    required: true,
    description: "Input for the CreateMetadataWorkflowStep operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateMediaAssetWorkflowSubStepResponse,
    headers: {
      Location: {
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Body() request: CreateMediaAssetWorkflowSubStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifyWorkflowStepExists(workflowId, workflowStepId);

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowStep(
        $workflowId: uuid!
        $workflowStepId: uuid!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_media_asset_workflow_step_one(
          object: {
            workflowId: $workflowId
            type: $workflowStepType
            status: $workflowStepStatus
            progress: $progress
            startedTime: $startedTime
            parent_step_id: $workflowStepId
          }
        ) {
          ${BASE_MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowSubStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepId: workflowStepId,
          workflowStepType: request.step.type,
          workflowStepStatus: MediaAssetWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    const createdWorkflowStep: MediaAssetWorkflowSubStep =
      toSubStepDomainObject(
        insertResponse.insert_dionysus_media_asset_workflow_step_one,
      );

    const responseBody: CreateMediaAssetWorkflowSubStepResponse = {
      step: createdWorkflowStep,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/media/workflow/${workflowId}/step/${createdWorkflowStep.id}`,
      )
      .send(responseBody);
  }
}
