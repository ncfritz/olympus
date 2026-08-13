import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { EmptyResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class DeleteMediaWorkflowController {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    protected readonly amqpConnection: AmqpConnection,
  ) {}

  @Delete("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Deletes a media workflow",
    description:
      "Deletes a media workflow.  By default the workflow will be soft deleted.  When the `hardDelete` parameter" +
      "is set to `true` the workflow will be removed from the database.  It is important to ensure any physical file" +
      "cleanup has completed before issuing a hard delete",
    operationId: "DeleteMediaAssetWorkflow",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "workflowId",
    description: "The ID of the workflow to describe.",
    type: String,
  })
  @ApiQuery({
    name: "hardDelete",
    description:
      "When set to `true` the workflow will be removed from the database.",
    type: Boolean,
    required: false,
    default: false,
  })
  @ApiNoContentResponse({
    description: "The record has been successfully deleted.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("workflowId") workflowId: string,
    @Query("hardDelete", ParseBoolPipe) hardDelete = false,
    @Res() response: Response,
  ): Promise<void> {
    let responseCode = HttpStatus.OK;

    if (hardDelete) {
      const deleteRequest = gql`
        mutation HardDeleteMediaAssetWorkflow($workflowId: uuid!) {
          delete_dionysus_media_asset_workflow_step(
            where: { workflowId: { _eq: workflowId } }
          ) {
            affected_rows
          }
          delete_dionysus_media_asset_download(
            where: { workflowId: { _eq: workflowId } }
          ) {
            affected_rows
          }
          delete_dionysus_media_asset_workflow_by_pk(id: workflowId) {
            id
          }
        }
      `;

      await this.graphQLClient.request(deleteRequest, {
        workflowId: workflowId,
      });

      responseCode = HttpStatus.NO_CONTENT;
    } else {
      const deleteRequest = gql`
        mutation SoftDeleteMediaAssetWorkflow(
          $workflowId: uuid!
          $deletionTime: timestamptz!
        ) {
          update_dionysus_media_asset_workflow_by_pk(
            pk_columns: { id: $workflowId }
            _set: { deleted: true, deleted_at: $deletionTime }
          ) {
            id
          }
        }
      `;
      const now = moment.utc();

      await this.graphQLClient.request(deleteRequest, {
        workflowId: workflowId,
        deletionTime: now.toISOString(),
      });

      await this.amqpConnection.publish(
        "media.trigger",
        "jobType.deleteWorkflow",
        {
          workflowId: workflowId,
        },
      );
    }

    const responseBody: EmptyResponse = {};

    response.status(responseCode).send(responseBody);
  }
}
