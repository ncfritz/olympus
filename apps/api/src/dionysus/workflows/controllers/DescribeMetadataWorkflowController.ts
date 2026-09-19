import { DescribeWorkflowResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MetadataWorkflowService } from "../services/MetadataWorkflowService";

@Controller({ version: "1" })
export class DescribeMetadataWorkflowController {
  constructor(private readonly metadataWorkflows: MetadataWorkflowService) {}

  @Get("/workflow/:workflowId")
  @ApiOperation({
    summary: "Describes an existing metadata workflow",
    description: "Retrieves the details of a metadata workflow.",
    operationId: "DescribeMetadataWorkflow",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: DescribeWorkflowResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeWorkflowResponse = {
      workflow: await this.metadataWorkflows.describe(workflowId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
