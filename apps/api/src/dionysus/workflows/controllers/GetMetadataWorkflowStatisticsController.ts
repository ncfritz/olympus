import { GetMetadataWorkflowStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MetadataWorkflowService } from "../services/MetadataWorkflowService";

@Controller({ version: "1" })
export class GetMetadataWorkflowStatisticsController {
  constructor(private readonly metadataWorkflows: MetadataWorkflowService) {}

  @Get("/workflow/stats")
  @ApiOperation({
    summary: "Get workflow status counts and timing statistics",
    description:
      "Retrieves status counts and timing statistics for metadata workflows.",
    operationId: "GetMetadataWorkflowStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were successfully fetched.",
    type: () => GetMetadataWorkflowStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const modeledResponse: GetMetadataWorkflowStatisticsResponse =
      await this.metadataWorkflows.getStatistics();

    response.status(HttpStatus.OK).send(modeledResponse);
  }
}
