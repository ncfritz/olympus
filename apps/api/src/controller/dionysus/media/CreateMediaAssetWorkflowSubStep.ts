import {
  MediaAssetWorkflowStepStatus,
  CreateMediaAssetWorkflowSubStepRequest,
  CreateMediaAssetWorkflowSubStepResponse,
  MediaAssetWorkflowSubStep,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toSubStepDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { BASE_MEDIA_ASSET_WORKFLOW_STEP } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlMediaAssetWorkflowSubStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";
import { DescribeMediaAssetWorkflowStepController } from "./DescribeMediaAssetWorkflowStep";
import { setLocation } from "../../../utils/location";

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
        schema: { type: "string" },
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Body() request: CreateMediaAssetWorkflowSubStepRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stepDetails = await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
    );

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowSubStep(
        $workflowId: uuid!
        $assetType: String!
        $mediaId: numeric!
        $workflowStepId: uuid!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_media_asset_workflow_step_one(
          object: {
            workflowId: $workflowId
            assetType: $assetType
            mediaId: $mediaId
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
          assetType: stepDetails.assetType,
          mediaId: stepDetails.mediaId,
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

    setLocation(
      response,
      httpRequest,
      DescribeMediaAssetWorkflowStepController,
      { workflowId, workflowStepId: createdWorkflowStep.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
