import {
  MetadataJobType,
  UpdateMetadataFetchJobRequest,
  UpdateMetadataFetchJobResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpStatus,
  Param,
  Put,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class UpdateMetadataFetchJobController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Put("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Updates an existing metadata fetch job",
    description:
      "Applies the given changes to a metadata fetch job. If the job ends up queued and `publishNotification` is not `false`, a fetch message is published.",
    operationId: "UpdateMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiConsumes("application/json")
  @ApiBody({
    type: UpdateMetadataFetchJobRequest,
    description: "Input for the UpdateMetadataFetchJob operation",
  })
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to update",
    type: String,
  })
  @ApiParam({
    name: "entityType",
    description: "The type the job to update",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
  })
  @ApiOkResponse({
    type: UpdateMetadataFetchJobResponse,
    description: "The record has been successfully updated.",
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(ClassSerializerInterceptor)
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: MetadataJobType,
    @Body() request: Partial<UpdateMetadataFetchJobRequest>,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateMetadataFetchJobResponse = {
      job: await this.metadataFetchJobs.update(entityId, entityType, request),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
