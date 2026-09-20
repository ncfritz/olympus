import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ListSyncRunsQuery, ListSyncRunsResponse } from "../../model/syncRuns";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SyncRunService } from "../services/SyncRunService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListSyncRunsController {
  constructor(private readonly syncRuns: SyncRunService) {}

  @Get("/sync-runs")
  @ApiOperation({
    summary: "Lists sync runs",
    description:
      "Returns the recorded sync runs, newest first, filtered and paged by the query.",
    operationId: "ListSyncRuns",
    tags: ["Sync Runs"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The runs were listed.",
    type: ListSyncRunsResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: ListSyncRunsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListSyncRunsResponse = {
      syncRuns: await this.syncRuns.list(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
