import {
  CreateMediaAssetWorkflowStepRequest,
  CreateMediaAssetWorkflowStepResponse,
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMediaAssetWorkflowStepController } from "./DescribeMediaAssetWorkflowStepController";
import { setLocation } from "../../../../utils/location";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class CreateMediaAssetWorkflowStepController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

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
    const createdWorkflowStep = await this.workflows.createStep(
      workflowId,
      request.step,
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
