import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
  UpdateMediaAssetWorkflowStepResponse,
} from "@ncfritz/olympus-model";
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
import { GraphQLClient } from "graphql-request";
import moment from "moment";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { logger } from "../../../utils/logger";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";

@Controller({ version: "1" })
export class VerifyMediaAssetTranscodeConfigurationController extends BaseMediaAssetWorkflowController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Put("/media/workflow/:workflowId/steps/:workflowStepId/verifyConfig")
  @ApiOperation({
    summary: "Updates an existing media asset workflow step",
    description: "Description",
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
    await this.verifyWorkflowExists(workflowId);
    const status = await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
      MediaAssetWorkflowStepType.VERIFY_TRANSCODE,
    );

    const newStatus =
      status === MediaAssetWorkflowStepStatus.SKIPPED
        ? MediaAssetWorkflowStepStatus.SKIPPED
        : MediaAssetWorkflowStepStatus.SUCCESS;

    const updatedWorkflowStep = await this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      {
        status: newStatus,
        progress: 100,
        finishedTime: moment().utc(),
      },
    );

    logger.debug(
      `Workflow step ${workflowStepId} updated to status ${newStatus}`,
    );
    await this.amqpConnection.publish(
      "media.trigger",
      "jobType.transcode",
      {
        workflowId: workflowId,
        configurationStepId: workflowStepId,
      },
      {
        persistent: true,
      },
    );

    const responseBody: UpdateMediaAssetWorkflowStepResponse = {
      step: updatedWorkflowStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
