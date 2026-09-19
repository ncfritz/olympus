import {
  ApproveMediaAssetTranscodeConfigurationRequest,
  UpdateMediaAssetWorkflowStepResponse,
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
export class ApproveMediaAssetTranscodeConfigurationController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Put("/media/workflow/:workflowId/steps/:workflowStepId/approveConfig")
  @ApiOperation({
    summary: "Approves the transcode configuration for a media workflow",
    description:
      "Marks the transcode configuration step as running and publishes a transcode job. `verificationRequired` controls whether the transcode output must be verified before the workflow continues.",
    operationId: "ApproveMediaAssetTranscodeConfiguration",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: ApproveMediaAssetTranscodeConfigurationRequest,
    description:
      "Input for the ApproveMediaAssetTranscodeConfiguration operation",
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
    type: UpdateMediaAssetWorkflowStepResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Body() request: ApproveMediaAssetTranscodeConfigurationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateMediaAssetWorkflowStepResponse = {
      step: await this.workflows.approveTranscodeConfiguration(
        workflowId,
        workflowStepId,
        request,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
