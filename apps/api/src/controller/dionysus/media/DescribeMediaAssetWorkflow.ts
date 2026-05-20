import { SingleMediaAssetWorkflowResponse } from "@ncfritz/olympus-model";
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
import { toDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowConverter";
import { BASE_MEDIA_ASSET_WORKFLOW } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlMediaAssetWorkflow } from "../../../types/dionysus/media/mediaAssetWorkflow";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMediaAssetWorkflowResponse = {
  dionysus_media_asset_workflow_by_pk: GraphQlMediaAssetWorkflow;
};

@Controller({ version: "1" })
export class DescribeMediaAssetWorkflowController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Describes an existing media asset workflow",
    description: "Retrieves the details of a media asset workflow.",
    operationId: "DescribeMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe.",
    type: String,
  })
  @ApiOkResponse({
    type: SingleMediaAssetWorkflowResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeMediaWorkflowResult(
        $workflowId: uuid!
      ) {
        dionysus_media_asset_workflow_by_pk(
          id: $workflowId
        ) {
          ${BASE_MEDIA_ASSET_WORKFLOW}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMediaAssetWorkflowResponse>(
        fetchRequest,
        {
          workflowId: workflowId,
        },
      );

    if (!fetchResponse.dionysus_media_asset_workflow_by_pk) {
      throw new NotFoundException();
    }

    const fetchedWorkflow = toDomainObject(
      fetchResponse.dionysus_media_asset_workflow_by_pk,
    );

    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: fetchedWorkflow,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
