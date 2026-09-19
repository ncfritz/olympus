import { GetMetadataFetchJobStatusStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { MetadataFetchJobService } from "../services/MetadataFetchJobService";

@Controller({ version: "1" })
export class GetMetadataFetchJobStatisticsController {
  constructor(private readonly metadataFetchJobs: MetadataFetchJobService) {}

  @Get("/job/metadata/stats")
  @ApiOperation({
    summary: "Get job status counts for metadata fetch jobs",
    description:
      "Retrieves stats for metadat fetch jobs broken down by job type and status.",
    operationId: "GetMetadataFetchJobStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: GetMetadataFetchJobStatusStatisticsResponse,
    description: "The statistics were successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const modeledResponse: GetMetadataFetchJobStatusStatisticsResponse =
      await this.metadataFetchJobs.getStatistics();

    response.status(HttpStatus.OK).send(modeledResponse);
  }
}
