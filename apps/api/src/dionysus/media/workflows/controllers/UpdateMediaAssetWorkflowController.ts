import {
  SingleMediaAssetWorkflowResponse,
  UpdateMediaAssetWorkflowRequest,
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
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class UpdateMediaAssetWorkflowController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Put("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing media workflow",
    description: "Updates an existing media workflow.",
    operationId: "UpdateMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetWorkflowRequest,
    description: "Input for the UpdateMediaAssetWorkflow operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow.",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: SingleMediaAssetWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateMediaAssetWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: await this.workflows.update(workflowId, request.workflow),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
