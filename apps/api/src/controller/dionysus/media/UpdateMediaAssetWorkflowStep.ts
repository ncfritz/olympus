import {
  MediaAssetWorkflowStatus,
  MediaAssetWorkflowStepStatus,
  UpdateMediaAssetWorkflowStepRequest,
  UpdateMediaAssetWorkflowStepResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
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
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { logger } from "../../../utils/logger";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";

@Controller({ version: "1" })
export class UpdateMediaAssetWorkflowStepController extends BaseMediaAssetWorkflowController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Put("/media/workflow/:workflowId/steps/:workflowStepId")
  @ApiOperation({
    summary: "Updates an existing media asset workflow step",
    description: "Description",
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
    @Query("updateWorkflowStatus") updateWorkflowStatus: boolean = false,
    @Body() request: UpdateMediaAssetWorkflowStepRequest,
    @Res() response: Response,
  ): Promise<void> {
    logger.info(
      `Updating workflow step ${workflowStepId} to status ${request.step.status} - workflow update: ${updateWorkflowStatus}`,
    );

    await this.verifyWorkflowExists(workflowId);
    await this.verifyWorkflowStepExists(workflowId, workflowStepId);

    let workflowStatus: MediaAssetWorkflowStatus | undefined = undefined;

    if (request.step.status === MediaAssetWorkflowStepStatus.PENDING) {
      workflowStatus = MediaAssetWorkflowStatus.PENDING_INPUT;
    } else if (request.step.status === MediaAssetWorkflowStepStatus.FAILED) {
      workflowStatus = MediaAssetWorkflowStatus.FAILED;
    } else if (
      request.step.status === MediaAssetWorkflowStepStatus.SKIPPED ||
      request.step.status === MediaAssetWorkflowStepStatus.RUNNING
    ) {
      workflowStatus = MediaAssetWorkflowStatus.RUNNING;
    }

    if (
      updateWorkflowStatus &&
      request.step.status === MediaAssetWorkflowStepStatus.SUCCESS
    ) {
      workflowStatus = MediaAssetWorkflowStatus.SUCCESS;
    }

    const updatedWorkflowStep = await this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      request.step,
      workflowStatus,
    );

    const responseBody: UpdateMediaAssetWorkflowStepResponse = {
      step: updatedWorkflowStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
