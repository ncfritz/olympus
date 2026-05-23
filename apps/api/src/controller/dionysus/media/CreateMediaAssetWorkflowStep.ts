import {
  MediaAssetWorkflowStep,
  MediaAssetWorkflowStepStatus,
  CreateMediaAssetWorkflowStepRequest,
  CreateMediaAssetWorkflowStepResponse,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { GraphQlMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";

type GraphQlCreateMediaAssetWorkflowStepResponse = {
  insert_dionysus_media_asset_workflow_step_one: GraphQlMediaAssetWorkflowStep;
};

@Controller({ version: "1" })
export class CreateMediaAssetWorkflowStepController extends BaseMediaAssetWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/media/workflow/:workflowId/steps")
  @ApiOperation({
    summary: "Creates a new media asset workflow step",
    description: "Creates a new media asset workflow step.",
    operationId: "CreateMediaAssetWorkflowStep",
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
  @ApiBody({
    type: CreateMediaAssetWorkflowStepRequest,
    required: true,
    description: "Input for the CreateMetadataWorkflowStep operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateMediaAssetWorkflowStepResponse,
    headers: {
      Location: {
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateMediaAssetWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifyWorkflowExists(workflowId);

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowStep(
        $workflowId: uuid!
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
          }
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

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepType: request.step.type,
          workflowStepStatus: MediaAssetWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    const createdWorkflowStep: MediaAssetWorkflowStep = toDomainObject(
      insertResponse.insert_dionysus_media_asset_workflow_step_one,
    );

    const responseBody: CreateMediaAssetWorkflowStepResponse = {
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
