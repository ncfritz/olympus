import {
  UpdateWorkflowRequest,
  UpdateWorkflowResponse,
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MetadataWorkflowService } from "../services/MetadataWorkflowService";

@Controller({ version: "1" })
export class UpdateMetadataWorkflowController {
  constructor(private readonly metadataWorkflows: MetadataWorkflowService) {}

  @Put("/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing metadata workflow",
    description: "Applies the given changes to a metadata workflow.",
    operationId: "UpdateMetadataWorkflow",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateWorkflowRequest,
    description: "Input for the UpdateBatchJob operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateWorkflowResponse = {
      workflow: await this.metadataWorkflows.update(
        workflowId,
        request.workflow,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
