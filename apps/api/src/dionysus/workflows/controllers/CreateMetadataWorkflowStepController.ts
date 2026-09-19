import {
  CreateWorkflowStepRequest,
  CreateWorkflowStepResponse,
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeMetadataWorkflowStepController } from "./DescribeMetadataWorkflowStepController";
import { setLocation } from "../../../utils/location";
import { MetadataWorkflowStepService } from "../services/MetadataWorkflowStepService";

@Controller({ version: "1" })
export class CreateMetadataWorkflowStepController {
  constructor(
    private readonly metadataWorkflowSteps: MetadataWorkflowStepService,
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
        schema: { type: "string" },
        description: "The location of the created workflow step",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: CreateWorkflowStepRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdWorkflowStep = await this.metadataWorkflowSteps.create(
      workflowId,
      request.step,
    );

    const responseBody: CreateWorkflowStepResponse = {
      step: createdWorkflowStep,
    };

    setLocation(response, httpRequest, DescribeMetadataWorkflowStepController, {
      workflowId,
      stepId: createdWorkflowStep.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
