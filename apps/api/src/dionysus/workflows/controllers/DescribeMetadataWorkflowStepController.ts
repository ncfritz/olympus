import { DescribeWorkflowStepResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MetadataWorkflowStepService } from "../services/MetadataWorkflowStepService";

@Controller({ version: "1" })
export class DescribeMetadataWorkflowStepController {
  constructor(
    private readonly metadataWorkflowSteps: MetadataWorkflowStepService,
  ) {}

  @Get("/workflow/:workflowId/step/:stepId")
  @ApiOperation({
    summary: "Describes a step of a metadata workflow",
    description:
      "Retrieves the details of a single step of a metadata workflow.",
    operationId: "DescribeMetadataWorkflowStep",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe the step for",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "stepId",
    description: "The ID of the workflow step to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: DescribeWorkflowStepResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("stepId") stepId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeWorkflowStepResponse = {
      step: await this.metadataWorkflowSteps.describe(workflowId, stepId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
