import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  CreateWorkflowStepRequest,
  CreateWorkflowStepResponse,
  WorkflowStatus,
  WorkflowStep,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Post,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowStepConverter";
import { GraphQlWorkflowStep } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetParentWorkflowIdResponse = {
  dionysus_metadata_workflow_by_pk: {
    id: string;
  };
};

type GraphQlCreateMetadataWorkflowStepResponse = {
  insert_dionysus_metadata_workflow_step_one: GraphQlWorkflowStep;
};

@Controller({ version: "1" })
export class CreateMetadataWorkflowStepController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/workflow/:workflowId/steps")
  @ApiOperation({
    summary: "Creates a new metadata workflow step",
    description: "Creates a new metadata workflow step.",
    operationId: "CreateMetadataWorkflowStep",
    tags: ["Workflow"],
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
    type: CreateWorkflowStepRequest,
    required: true,
    description: "Input for the CreateMetadataWorkflowStep operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateWorkflowStepResponse,
    headers: {
      Location: {
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    const checkParentWorkflowRequest = gql`
      query GetTargetWorkflow($id: uuid!) {
        dionysus_metadata_workflow_by_pk(id: $id) {
          id
        }
      }
    `;

    const checkParentWorkflowResponse =
      await this.graphQLClient.request<GraphQlGetParentWorkflowIdResponse>(
        checkParentWorkflowRequest,
        { id: workflowId },
      );

    if (!checkParentWorkflowResponse.dionysus_metadata_workflow_by_pk?.id) {
      throw new BadRequestException();
    }

    const insertRequest = gql`
      mutation CreateMetadataWorkflowStep(
        $workflowId: uuid!
        $attempt: numeric!
        $workflowStepType: String!
        $batchJobType: String!
        $batchJobStatus: String!
      ) {
        insert_dionysus_metadata_workflow_step_one(
          object: {
            attempt: $attempt
            job: { data: { type: $batchJobType, status: $batchJobStatus } }
            type: $workflowStepType
            workflow_id: $workflowId
          }
        ) {
          attempt
          createdTime
          id
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
          lastUpdatedTime
          type
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataWorkflowStepResponse>(
        insertRequest,
        {
          workflowId: workflowId,
          workflowStepType: request.step.type,
          attempt: request.step.attempt,
          batchJobType: request.step.jobType,
          batchJobStatus: WorkflowStatus.CREATED,
        },
      );

    const createdWorkflowStep: WorkflowStep = toDomainObject(
      insertResponse.insert_dionysus_metadata_workflow_step_one,
    );
    const createdBatchJob = createdWorkflowStep.job;

    if (!createdBatchJob) {
      throw new InternalServerErrorException();
    }

    await this.amqpConnection.publish(
      "batchJob.trigger",
      `jobType.${createdBatchJob.type}`,
      {
        jobType: createdBatchJob.type,
        jobId: createdBatchJob.id,
        workflowId: workflowId,
        stepId: createdWorkflowStep.id,
        offset: request.step.offset,
        attempt: request.step.attempt,
      },
    );

    const responseBody: CreateWorkflowStepResponse = {
      step: createdWorkflowStep,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/metdata/workflow/${workflowId}/step/${createdWorkflowStep.id}`,
      )
      .send(responseBody);
  }
}
