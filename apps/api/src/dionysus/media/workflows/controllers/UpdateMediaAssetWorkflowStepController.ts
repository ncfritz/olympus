import {
  UpdateMediaAssetWorkflowStepRequest,
  UpdateMediaAssetWorkflowStepResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  DefaultValuePipe,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Put,
  Query,
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
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class UpdateMediaAssetWorkflowStepController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Put("/media/workflow/:workflowId/steps/:workflowStepId")
  @ApiOperation({
    summary: "Updates an existing media asset workflow step",
    description: "Applies the given changes to a media asset workflow step.",
    operationId: "UpdateMediaAssetWorkflowStep",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMediaAssetWorkflowStepRequest,
    description: "Input for the UpdateMediaAssetWorkflowStep operation",
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
  @ApiQuery({
    name: "updateWorkflowStatus",
    description:
      "If `true` AND the workflow step status is `success`, the workflow status will be updated to `success`.  Any" +
      "other step status will not result in the workflow status being updated.",
    required: false,
    default: false,
    type: Boolean,
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
    @Query("updateWorkflowStatus", new DefaultValuePipe(false), ParseBoolPipe)
    updateWorkflowStatus: boolean,
    @Body() request: UpdateMediaAssetWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateMediaAssetWorkflowStepResponse = {
      step: await this.workflows.updateStep(
        workflowId,
        workflowStepId,
        request.step,
        updateWorkflowStatus,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
