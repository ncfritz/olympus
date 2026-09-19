import {
  MediaAssetSearchType,
  SingleMediaAssetWorkflowResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMediaAssetWorkflowController } from "./DescribeMediaAssetWorkflowController";
import { setLocation } from "../../../../utils/location";
import { MediaAssetWorkflowService } from "../services/MediaAssetWorkflowService";

@Controller({ version: "1" })
export class CreateMediaAssetWorkflowController {
  constructor(private readonly workflows: MediaAssetWorkflowService) {}

  @Post(
    "/media/searchConfiguration/:mediaType/:mediaId/workflow/:resultId/workflow",
  )
  @ApiOperation({
    summary: "Creates a new media asset workflow",
    description: "Creates a new media asset workflow.",
    operationId: "CreateMediaAssetWorkflow",
    tags: ["Media"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "mediaType",
    description: "The type of media asset the search download is for",
    enum: MediaAssetSearchType,
    enumName: "MediaAssetSearchType",
    enumSchema: { description: "The type of media asset" },
  })
  @ApiParam({
    name: "mediaId",
    description: "The ID of the media that the download is targeting.",
    type: Number,
  })
  @ApiParam({
    name: "resultId",
    description: "The ID of the search result to download.",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleMediaAssetWorkflowResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the media download record",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("mediaType", new ParseEnumPipe(MediaAssetSearchType))
    mediaType: MediaAssetSearchType,
    @Param("mediaId", ParseIntPipe) mediaId: number,
    @Param("resultId") resultId: string,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdWorkflow = await this.workflows.create(
      mediaType,
      mediaId,
      resultId,
    );

    const responseBody: SingleMediaAssetWorkflowResponse = {
      workflow: createdWorkflow,
    };

    setLocation(response, httpRequest, DescribeMediaAssetWorkflowController, {
      workflowId: createdWorkflow.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
