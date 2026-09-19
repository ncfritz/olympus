import { DescribeMediaAssetWorkflowStepResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class DescribeMediaAssetWorkflowStepController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Get("/media/workflow/:workflowId/step/:workflowStepId")
  @ApiOperation({
    summary: "Describes an existing media asset workflow step",
    description: "Retrieves the details of a media asset workflow step.",
    operationId: "DescribeMediaAssetWorkflowStep",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow the step is a part of.",
    type: String,
  })
  @ApiParam({
    name: "workflowStepId",
    description: "The ID of the workflow step to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeMediaAssetWorkflowStepResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeMediaAssetWorkflowStepResponse = {
      step: await this.workflows.describeStep(workflowId, workflowStepId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
