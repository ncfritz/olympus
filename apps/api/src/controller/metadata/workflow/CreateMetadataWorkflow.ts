import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  WorkflowStatus,
  Workflow,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowConverter";
import { GraphQLWorkflow } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlCreateMetadataWorkflowResponse = {
  insert_dionysus_metadata_workflow_one: GraphQLWorkflow;
};

@Controller()
export class CreateMetadataWorkflowController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/v1/metadata/workflows")
  @ApiOperation({
    summary: "Creates a new metadata workflow",
    description: "Creates a new metadata workflow.",
    operationId: "CreateMetadataWorkflow",
    tags: ["Workflow"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateWorkflowRequest,
    required: true,
    description: "Input for the CreateMetadataWorkflow operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateWorkflowResponse,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateMetadataWorkflow($status: String!) {
        insert_dionysus_metadata_workflow_one(object: { status: $status }) {
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
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateMetadataWorkflowResponse>(
        insertRequest,
        { status: WorkflowStatus.CREATED },
      );

    const createdWorkflow: Workflow = toDomainObject(
      insertResponse.insert_dionysus_metadata_workflow_one,
    );

    await this.amqpConnection.publish(
      "batchJob.workflow",
      `workflowCreated`,
      {
        workflowId: createdWorkflow.id,
      },
      {
        persistent: true,
        headers: {
          "x-delay": 15000,
        },
      },
    );

    const responseBody: CreateWorkflowResponse = {
      workflow: createdWorkflow,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/workflow/${encodeURIComponent(
          createdWorkflow.id,
        )}`,
      )
      .send(responseBody);
  }
}
