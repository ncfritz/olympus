import {
  DeleteMetadataFetchJobResponse,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class DeleteMetadataFetchJobController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Delete("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Deleted an existing metadate fetch job",
    description: "Deletes the specified fetch job.",
    operationId: "DeleteMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to delete",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "entityType",
    description: "The type the job to delete",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
  })
  @ApiNoContentResponse({
    description: "The record has been successfully deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DeleteMetadataFetchJobResponse = {
      job: await this.metadataFetchJobs.delete(entityId, entityType),
    };

    response.status(HttpStatus.NO_CONTENT).send(responseBody);
  }
}
