import { DescribeMediaAssetWorkflowStepResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { MEDIA_ASSET_WORKFLOW_STEP } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMediaAssetWorkflowStepResponse = {
  dionysus_media_asset_workflow_step_by_pk: GraphQlMediaAssetWorkflowStep;
};

@Controller({ version: "1" })
export class DescribeMediaAssetWorkflowStepController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/workflow/:workflowId/step/:workflowStepId")
  @ApiOperation({
    summary: "Describes an existing media asset workflow step",
    description: "Retrieves the details of a media asset workflow step.",
    operationId: "DescribeMediaAssetWorkflowStep",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow the step is a part of.",
    type: String,
  })
  @ApiParam({
    name: "workflowStepId",
    description: "The ID of the workflow step to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeMediaAssetWorkflowStepResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("workflowStepId") workflowStepId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMediaWorkflowStepResult(
        $workflowId: uuid!
        $workflowStepId: uuid!
      ) {
        dionysus_media_asset_workflow_step_by_pk(
          workflowId: $workflowId
          id: $workflowStepId
        ) {
          ${MEDIA_ASSET_WORKFLOW_STEP}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetWorkflowStepResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
          workflowStepId: workflowStepId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_workflow_step_by_pk) {
      throw new NotFoundException();
    }

    const fetchedWorkflowStep = toDomainObject(
      fetchResponse.dionysus_media_asset_workflow_step_by_pk,
    );

    const responseBody: DescribeMediaAssetWorkflowStepResponse = {
      step: fetchedWorkflowStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
