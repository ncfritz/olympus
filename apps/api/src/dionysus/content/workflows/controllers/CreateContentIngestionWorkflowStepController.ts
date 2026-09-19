import {
  ContentIngestionWorkflowStep,
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
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentIngestionWorkflowService } from "../services/ContentIngestionWorkflowService";

@Controller({ version: "1" })
export class CreateContentIngestionWorkflowStepController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

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
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateContentIngestionWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    const createdWorkflowStep: ContentIngestionWorkflowStep =
      await this.contentIngestionWorkflows.createStep(workflowId, request.step);

    const responseBody: CreateContentIngestionWorkflowStepResponse = {
      step: createdWorkflowStep,
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
