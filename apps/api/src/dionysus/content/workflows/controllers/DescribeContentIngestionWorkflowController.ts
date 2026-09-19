import { DescribeContentIngestionWorkflowResponse } from "@ncfritz/olympus-model";
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
import { GraphQLContentIngestionWorkflow } from "../types/workflow";
import { toDomainObject } from "../converters/ContentIngestionWorkflowConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetContentIngestionWorkflowResponse = {
  dionysus_content_asset_ingest_workflows_by_pk: GraphQLContentIngestionWorkflow;
};

@Controller({ version: "1" })
export class DescribeContentIngestionWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/workflow/:workflowId")
  @ApiOperation({
    summary: "Describes an existing content ingestion workflow",
    description: "Retrieves the details of a content ingestion workflow.",
    operationId: "DescribeContentIngestionWorkflow",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: DescribeContentIngestionWorkflowResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeContentIngestionWorkflow($id: uuid!) {
        dionysus_content_asset_ingest_workflows_by_pk(id: $id) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          source
          sourceType
          startedTime
          status
          steps_aggregate {
            aggregate {
              count
            }
          }
          steps(order_by: { createdTime: asc }) {
            createdTime
            finishedTime
            id
            lastUpdatedTime
            progress
            startedTime
            status
            type
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetContentIngestionWorkflowResponse>(
        fetchRequest,
        {
          id: workflowId,
        },
      );

    if (!fetchResponse.dionysus_content_asset_ingest_workflows_by_pk) {
      throw new NotFoundException();
    }

    const fetchedWorkflow = toDomainObject(
      fetchResponse.dionysus_content_asset_ingest_workflows_by_pk,
    );

    const responseBody: DescribeContentIngestionWorkflowResponse = {
      workflow: fetchedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
