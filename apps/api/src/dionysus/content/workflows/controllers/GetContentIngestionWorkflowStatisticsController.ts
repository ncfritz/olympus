import { GetContentIngestionWorkflowStatisticsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentIngestionWorkflowService } from "../services/ContentIngestionWorkflowService";

@Controller({ version: "1" })
export class GetContentIngestionWorkflowStatisticsController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

  @Get("/content/workflow/stats")
  @ApiOperation({
    summary: "Get workflow status counts and source statistics",
    description:
      "Retrieves stats for content ingestion workflows including aggregate " +
      "status and source statistics and daily status breakdowns for the past " +
      "30 days.",
    operationId: "GetContentIngestionWorkflowStatistics",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were successfully fetched.",
    type: () => GetContentIngestionWorkflowStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const modeledResponse: GetContentIngestionWorkflowStatisticsResponse =
      await this.contentIngestionWorkflows.getStatistics();

    response.status(HttpStatus.OK).send(modeledResponse);
  }
}
