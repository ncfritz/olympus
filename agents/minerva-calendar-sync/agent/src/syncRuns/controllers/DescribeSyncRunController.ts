import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeSyncRunResponse } from "../../model/syncRuns";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SyncRunService } from "../services/SyncRunService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeSyncRunController {
  constructor(private readonly syncRuns: SyncRunService) {}

  @Get("/sync-run/:syncRunId")
  @ApiOperation({
    summary: "Describes a sync run",
    description: "Returns a recorded sync run with the event changes it made.",
    operationId: "DescribeSyncRun",
    tags: ["Sync Runs"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "syncRunId",
    description: "The ID of the sync run",
    type: String,
  })
  @ApiOkResponse({
    description: "The run was found.",
    type: DescribeSyncRunResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("syncRunId") syncRunId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeSyncRunResponse = {
      syncRun: await this.syncRuns.describe(syncRunId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
