import {
  CreateWorkflowRequest,
  CreateWorkflowResponse,
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeMetadataWorkflowController } from "./DescribeMetadataWorkflowController";
import { setLocation } from "../../../utils/location";
import { MetadataWorkflowService } from "../services/MetadataWorkflowService";

@Controller({ version: "1" })
export class CreateMetadataWorkflowController {
  constructor(private readonly metadataWorkflows: MetadataWorkflowService) {}

  @Post("/workflows")
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
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateWorkflowRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdWorkflow = await this.metadataWorkflows.create();

    const responseBody: CreateWorkflowResponse = {
      workflow: createdWorkflow,
    };

    setLocation(response, httpRequest, DescribeMetadataWorkflowController, {
      workflowId: createdWorkflow.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
