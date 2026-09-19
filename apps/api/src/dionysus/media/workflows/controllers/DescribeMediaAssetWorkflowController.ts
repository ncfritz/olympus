import { SingleMediaAssetWorkflowResponse } from "@ncfritz/olympus-model";
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
export class DescribeMediaAssetWorkflowController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Get("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Describes an existing media asset workflow",
    description: "Retrieves the details of a media asset workflow.",
    operationId: "DescribeMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetWorkflowResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: await this.workflows.describe(workflowId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
