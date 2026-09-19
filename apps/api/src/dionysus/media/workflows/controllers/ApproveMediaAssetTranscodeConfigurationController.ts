import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  ApproveMediaAssetTranscodeConfigurationRequest,
  MediaAssetWorkflowStepStatus,
  MediaAssetWorkflowStepType,
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
import { GraphQLClient } from "graphql-request";
import moment from "moment";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseMediaAssetWorkflowController } from "./BaseMediaAssetWorkflowController";

@Controller({ version: "1" })
export class ApproveMediaAssetTranscodeConfigurationController extends BaseMediaAssetWorkflowController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

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
    await this.verifyWorkflowExists(workflowId);
    await this.verifyWorkflowStepExists(
      workflowId,
      workflowStepId,
      MediaAssetWorkflowStepType.CONFIGURE_TRANSCODE,
    );
    const updatedWorkflowStep = await this.updateWorkflowStep(
      workflowId,
      workflowStepId,
      {
        status: MediaAssetWorkflowStepStatus.RUNNING,
        progress: 100,
        finishedTime: moment().utc(),
      },
    );

    await this.amqpConnection.publish(
      "media.trigger",
      "jobType.transcodeConfiguration",
      {
        workflowId: workflowId,
        configurationStepId: workflowStepId,
        videoStreamIndex: request.videoTrackIndex,
        audioStreamIndex: request.audioTrackIndex,
        subtitleStreamIndex: request.subtitleTrackIndex,
        mediaExtension: request.originalAssetExtension,
        transcodeVerificationRequired: request.verificationRequired,
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
