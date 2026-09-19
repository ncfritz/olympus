import {
  MediaAssetWorkflowStepStatus,
  CreateMediaAssetWorkflowStepRequest,
  CreateMediaAssetWorkflowStepResponse,
  DecoratedMediaAssetWorkflowStep,
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
import { toDecoratedDomainObject } from "../converters/MediaAssetWorkflowStepConverter";
import { BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP } from "../queries/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflowStep } from "../types/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";
import { DescribeMediaAssetWorkflowStepController } from "./DescribeMediaAssetWorkflowStepController";
import { setLocation } from "../../../../utils/location";

type GraphQlCreateMediaAssetWorkflowStepResponse = {
  insert_dionysus_media_asset_workflow_step_one: GraphQlDecoratedMediaAssetWorkflowStep;
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
        schema: { type: "string" },
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateMediaAssetWorkflowStepRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const workflowDetails = await this.verifyWorkflowExists(workflowId);

    const insertRequest = gql`
      mutation CreateMediaAssetWorkflowStep(
        $workflowId: uuid!
        $assetType: String!
        $mediaId: numeric!
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
          }
        ) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMediaAssetWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          assetType: workflowDetails.type,
          mediaId: workflowDetails.mediaId,
          workflowStepType: request.step.type,
          workflowStepStatus: MediaAssetWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    const createdWorkflowStep: DecoratedMediaAssetWorkflowStep =
      toDecoratedDomainObject(
        insertResponse.insert_dionysus_media_asset_workflow_step_one,
      );

    const responseBody: CreateMediaAssetWorkflowStepResponse = {
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
