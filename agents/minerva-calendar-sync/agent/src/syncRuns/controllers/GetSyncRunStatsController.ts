import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  GetSyncRunStatsQuery,
  GetSyncRunStatsResponse,
} from "../../model/syncRuns";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SyncRunService } from "../services/SyncRunService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetSyncRunStatsController {
  constructor(private readonly syncRuns: SyncRunService) {}

  @Get("/sync-runs/stats")
  @ApiOperation({
    summary: "Gets sync run statistics",
    description:
      "Returns per-day, per-calendar counts and durations of the recorded runs over a trailing window.",
    operationId: "GetSyncRunStats",
    tags: ["Sync Runs"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were computed.",
    type: GetSyncRunStatsResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: GetSyncRunStatsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetSyncRunStatsResponse = {
      syncRunStats: await this.syncRuns.getStats(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
