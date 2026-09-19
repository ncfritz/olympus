import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  CreateContentIngestionWorkflowRequest,
  CreateContentIngestionWorkflowResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentIngestionWorkflowController } from "./BaseContentIngestionWorkflowController";
import { DescribeContentIngestionWorkflowController } from "./DescribeContentIngestionWorkflowController";
import { setLocation } from "../../../../utils/location";

@Controller({ version: "1" })
export class CreateContentIngestionWorkflowController extends BaseContentIngestionWorkflowController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Post("/content/workflows")
  @ApiOperation({
    summary: "Creates a new content ingestion workflow",
    description: "Creates a new content ingestion workflow.",
    operationId: "CreateContentIngestionWorkflow",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentIngestionWorkflowRequest,
    required: true,
    description: "Input for the CreateContentIngestionWorkflow operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentIngestionWorkflowResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentIngestionWorkflowRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdWorkflow = await this.createContentIngestionWorkflow(
      request.workflow.source,
      request.workflow.sourceType,
    );

    await this.amqpConnection.publish("content.trigger", "jobType.rawIngest", {
      workflowId: createdWorkflow.id,
      assetLocation: request.workflow.source,
      skipWorkflow: false,
    });

    const responseBody: CreateContentIngestionWorkflowResponse = {
      workflow: createdWorkflow,
    };

    setLocation(
      response,
      httpRequest,
      DescribeContentIngestionWorkflowController,
      { workflowId: createdWorkflow.id },
    );

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
