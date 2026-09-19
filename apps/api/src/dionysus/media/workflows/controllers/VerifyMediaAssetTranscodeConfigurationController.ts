import { UpdateMediaAssetWorkflowStepResponse } from "@ncfritz/olympus-model";
import {
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
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
export class VerifyMediaAssetTranscodeConfigurationController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Put("/media/workflow/:workflowId/steps/:workflowStepId/verifyConfig")
  @ApiOperation({
    summary: "Completes transcode verification for a media workflow",
    description:
      "Marks the transcode verification step as complete (or leaves it skipped) and publishes the transcode job.",
    operationId: "VerifyMediaAssetTranscodeConfiguration",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
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
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateMediaAssetWorkflowStepResponse = {
      step: await this.workflows.verifyTranscodeConfiguration(
        workflowId,
        workflowStepId,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
