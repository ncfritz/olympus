import {
  UpdateContentIngestionWorkflowStepRequest,
  UpdateContentIngestionWorkflowStepResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentIngestionWorkflowService } from "../services/ContentIngestionWorkflowService";

@Controller({ version: "1" })
export class UpdateContentIngestionWorkflowStepController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

  @Put("/content/workflow/:workflowId/steps/:workflowStepId")
  @ApiOperation({
    summary: "Updates an existing content ingestion workflow step",
    description:
      "Applies the given changes to a step of a content ingestion workflow.",
    operationId: "UpdateContentIngestionWorkflowStep",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateContentIngestionWorkflowStepRequest,
    description: "Input for the UpdateContentIngestionWorkflowStep operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiParam({
    name: "workflowStepId",
    description: "The ID of the workflow step to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentIngestionWorkflowStepResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Body() request: UpdateContentIngestionWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateContentIngestionWorkflowStepResponse = {
      step: await this.contentIngestionWorkflows.updateStep(
        workflowId,
        workflowStepId,
        request.step,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
