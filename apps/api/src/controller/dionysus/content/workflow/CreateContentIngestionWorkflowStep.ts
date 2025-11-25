import {
  ContentIngestionWorkflowStep,
  ContentIngestionWorkflowStepStatus,
  CreateContentIngestionWorkflowStepRequest,
  CreateContentIngestionWorkflowStepResponse,
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
import { GraphQlContentIngestionWorkflowStep } from "../../../../types/dionysus/content/workflow";
import { toDomainObject } from "../../../../convert/dionysus/content/workflow/ContentIngestionWorkflowStepConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentIngestionWorkflowController } from "./BaseContentIngestionWorkflowController";

type GraphQlCreateContentIngestionWorkflowStepResponse = {
  insert_dionysus_content_asset_ingest_workflow_steps_one: GraphQlContentIngestionWorkflowStep;
};

@Controller({ version: "1" })
export class CreateContentIngestionWorkflowStepController extends BaseContentIngestionWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/content/workflow/:workflowId/steps")
  @ApiOperation({
    summary: "Creates a new content ingestion workflow step",
    description: "Creates a new content ingestion workflow step.",
    operationId: "CreateContentIngestionWorkflowStep",
    tags: ["Content"],
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
    type: CreateContentIngestionWorkflowStepRequest,
    required: true,
    description: "Input for the CreateMetadataWorkflowStep operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentIngestionWorkflowStepResponse,
    headers: {
      Location: {
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateContentIngestionWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.verifyWorkflowExists(workflowId);

    const insertRequest = gql`
      mutation CreateContentIngestionWorkflowStep(
        $workflowId: uuid!
        $workflowStepType: String!
        $workflowStepStatus: String!
        $progress: numeric!
        $startedTime: timestamptz!
      ) {
        insert_dionysus_content_asset_ingest_workflow_steps_one(
          object: {
            workflow_id: $workflowId
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
      await this.graphQLClient.request<GraphQlCreateContentIngestionWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepType: request.step.type,
          workflowStepStatus: ContentIngestionWorkflowStepStatus.RUNNING,
          startedTime: moment().utc().toISOString(),
          progress: 0,
        },
      );

    const createdWorkflowStep: ContentIngestionWorkflowStep = toDomainObject(
      insertResponse.insert_dionysus_content_asset_ingest_workflow_steps_one,
    );

    const responseBody: CreateContentIngestionWorkflowStepResponse = {
      step: createdWorkflowStep,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/content/workflow/${workflowId}/step/${createdWorkflowStep.id}`,
      )
      .send(responseBody);
  }
}
