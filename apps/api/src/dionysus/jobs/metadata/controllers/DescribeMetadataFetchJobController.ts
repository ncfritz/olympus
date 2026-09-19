import {
  DescribeMetadataFetchJobResponse,
  MetadataJobType,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class DescribeMetadataFetchJobController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Get("/metadata/fetchJob/:entityId/:entityType")
  @ApiOperation({
    summary: "Describes an existing metadate fetch job",
    description: "Retrieves the details of a metadata fetch job.",
    operationId: "DescribeMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the job to describe",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "entityType",
    description: "The type of the job to describe",
    enum: MetadataJobType,
    enumName: "MetadataJobType",
    enumSchema: {
      description: "The type of entity a metadata fetch job retrieves",
    },
  })
  @ApiOkResponse({
    type: DescribeMetadataFetchJobResponse,
    description: "The record has been successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityId") entityId: string,
    @Param("entityType") entityType: MetadataJobType,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeMetadataFetchJobResponse = {
      job: await this.metadataFetchJobs.describe(entityId, entityType),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
