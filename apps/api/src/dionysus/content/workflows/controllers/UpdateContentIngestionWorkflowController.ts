import {
  UpdateContentIngestionWorkflowRequest,
  UpdateContentIngestionWorkflowResponse,
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
export class UpdateContentIngestionWorkflowController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

  @Put("/content/workflow/:workflowId")
  @ApiOperation({
    summary: "Updates an existing content ingestion workflow",
    description: "Applies the given changes to a content ingestion workflow.",
    operationId: "UpdateContentIngestionWorkflow",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateContentIngestionWorkflowRequest,
    description: "Input for the UpdateContentIngestionWorkflow operation",
  })
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to update",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully updated.",
    type: UpdateContentIngestionWorkflowResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Body() request: UpdateContentIngestionWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateContentIngestionWorkflowResponse = {
      workflow: await this.contentIngestionWorkflows.update(
        workflowId,
        request.workflow,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
