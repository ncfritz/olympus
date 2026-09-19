import { ListWorkflowStepsResponse } from "@ncfritz/olympus-model";
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
export class ListMetadataWorkflowStepsController {
  constructor(
    private readonly metadataWorkflowSteps: MetadataWorkflowStepService,
  ) {}

  @Get("/workflow/:workflowId/steps")
  @ApiOperation({
    summary: "Lists the steps of a metadata workflow",
    description: "Lists the steps of a metadata workflow.",
    operationId: "ListMetadataWorkflowSteps",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to list the steps for",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListWorkflowStepsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListWorkflowStepsResponse = {
      steps: await this.metadataWorkflowSteps.list(workflowId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
