import {
  ListWorkflowStepsResponse,
  WorkflowStep,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowStepConverter";
import { GraphQlWorkflowStep } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQLListMetadataWorkflowStepsResponse = {
  dionysus_metadata_workflow_step: GraphQlWorkflowStep[];
};

@Controller({ version: "1" })
export class ListMetadataWorkflowStepsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/workflow/:workflowId/steps")
  @ApiOperation({
    summary: "Lists the steps of a metadata workflow",
    description: "Lists the steps of a metadata workflow.",
    operationId: "ListMetadataWorkflowSteps",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to list the steps for",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListWorkflowStepsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMetadataWorkflowSteps($workflowId: uuid!) {
        dionysus_metadata_workflow_step(
          where: { workflow_id: { _eq: $workflowId } }
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
      await this.graphQLClient.request<GraphQLListMetadataWorkflowStepsResponse>(
        fetchRequest,
        { workflowId: workflowId },
      );
    const fetchedWorkflowSteps: WorkflowStep[] = [];

    fetchResponse.dionysus_metadata_workflow_step.forEach((result) => {
      fetchedWorkflowSteps.push(toDomainObject(result));
    });

    const responseBody: ListWorkflowStepsResponse = {
      steps: fetchedWorkflowSteps,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
