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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDecoratedDomainObject } from "../converters/MediaAssetWorkflowStepConverter";
import { BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP } from "../queries/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflowStep } from "../types/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMediaAssetWorkflowStepResponse = {
  dionysus_media_asset_workflow_step_by_pk: GraphQlDecoratedMediaAssetWorkflowStep;
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
      query DescribeMediaAssetWorkflowStep(
        $workflowId: uuid!
        $workflowStepId: uuid!
      ) {
        dionysus_media_asset_workflow_step_by_pk(
          workflowId: $workflowId
          id: $workflowStepId
        ) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
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

    const fetchedWorkflowStep = toDecoratedDomainObject(
      fetchResponse.dionysus_media_asset_workflow_step_by_pk,
    );

    const responseBody: DescribeMediaAssetWorkflowStepResponse = {
      step: fetchedWorkflowStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
