import { EmptyResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class DeleteMediaAssetWorkflowController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Delete("/media/workflow/:workflowId")
  @ApiOperation({
    summary: "Deletes a media workflow",
    description:
      "Deletes a media workflow. By default the workflow is soft deleted. When the `hardDelete` parameter is `true`, the workflow is removed from the database; make sure any physical file cleanup has completed before issuing a hard delete.",
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
    @Query("hardDelete", new DefaultValuePipe(false), ParseBoolPipe)
    hardDelete: boolean,
    @Res() response: Response,
  ): Promise<void> {
    await this.workflows.delete(workflowId, hardDelete);

    const responseCode = hardDelete ? HttpStatus.NO_CONTENT : HttpStatus.OK;
    const responseBody: EmptyResponse = {};

    response.status(responseCode).send(responseBody);
  }
}
