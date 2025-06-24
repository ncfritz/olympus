import { DescribeWorkflowResponse } from "@ncfritz/olympus-model";
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
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowConverter";
import { GraphQLWorkflow } from "../../../types/workflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMetadataWorkflowResponse = {
  dionysus_metadata_workflow_by_pk: GraphQLWorkflow;
};

@Controller()
export class DescribeMetadataWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/metadata/workflow/:workflowId")
  @ApiOperation({
    summary: "Describes an existing metadate workflow",
    description: "Retrieves the details of a metadata workflow.",
    operationId: "DescribeMetadataWorkflow",
    tags: ["Workflow"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: DescribeWorkflowResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeWorkflow($id: uuid!) {
        dionysus_metadata_workflow_by_pk(id: $id) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          startedTime
          status
          steps {
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
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataWorkflowResponse>(
        fetchRequest,
        {
          id: workflowId,
        },
      );

    if (!fetchResponse.dionysus_metadata_workflow_by_pk) {
      throw new NotFoundException();
    }

    const fetchedWorkflow = toDomainObject(
      fetchResponse.dionysus_metadata_workflow_by_pk,
    );

    const responseBody: DescribeWorkflowResponse = {
      workflow: fetchedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
