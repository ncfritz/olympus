import { DescribeWorkflowStepResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, NotFoundException, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowStepConverter";
import { GraphQlWorkflowStep } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMetadataWorkflowStepResponse = {
  dionysus_metadata_workflow_step_by_pk: GraphQlWorkflowStep;
};

@Controller()
export class DescribeMetadataWorkflowStepController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/metadata/workflow/:workflowId/step/:stepId")
  @ApiOperation({
    summary: "Describes an existing metadate workflow",
    description: "Retrieves the details of a metadata workflow.",
    operationId: "DescribeMetadataWorkflowStep",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe the step for",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "stepId",
    description: "The ID of the workflow step to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: DescribeWorkflowStepResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Param("stepId") stepId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMetadataWorkflowStep($workflowId: uuid!, $stepId: uuid!) {
        dionysus_metadata_workflow_step_by_pk(
          id: $stepId
          workflow_id: $workflowId
        ) {
          attempt
          createdTime
          id
          lastUpdatedTime
          type
          job {
            createdTime
            duplicateRecords
            expiredRecords
            finishedTime
            id
            lastUpdatedTime
            maxRecordsToProcess
            newRecords
            noOpRecords
            processedRecords
            skippedRecords
            startedTime
            status
            totalRecords
            type
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowStepResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
          stepId: stepId,
        },
      );

    if (!fetchResponse.dionysus_metadata_workflow_step_by_pk) {
      throw new NotFoundException();
    }

    const fetchedStep = toDomainObject(
      fetchResponse.dionysus_metadata_workflow_step_by_pk,
    );

    const responseBody: DescribeWorkflowStepResponse = {
      step: fetchedStep,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
