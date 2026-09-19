import {
  CreateMetadataFetchJobRequest,
  CreateMetadataFetchJobResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeMetadataFetchJobController } from "./DescribeMetadataFetchJobController";
import { setLocation } from "../../../../utils/location";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class CreateMetadataFetchJobController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Post("/metadata/fetchJobs")
  @ApiOperation({
    summary: "Creates a new metadata fetch job",
    description:
      "Creates a new job to fetch metadata for a TMBD entity.  This API will create a new job entity to track progress and enqueue a request to be " +
      "processed asynchronously.",
    operationId: "CreateMetadataFetchJob",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMetadataFetchJobRequest,
    required: true,
    description: "Input for the CreateMetadataFetchJob operation",
  })
  @ApiCreatedResponse({
    type: CreateMetadataFetchJobResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMetadataFetchJobRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdJob = await this.metadataFetchJobs.create(request);

    const responseBody: CreateMetadataFetchJobResponse = {
      job: createdJob,
    };

    setLocation(response, httpRequest, DescribeMetadataFetchJobController, {
      entityId: createdJob.id,
      entityType: createdJob.type,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
