import { GetBatchJobLogsResponse, LogLevel } from "@ncfritz/olympus-model";
import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import moment from "moment/moment";
import { v4 as uuidv4 } from "uuid";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller()
export class GetBatchJobLogsController {
  @Get("/v1/job/batch/:jobId/logs")
  @ApiOperation({
    summary: "Gets logs associated with a batch job",
    description:
      "Lists all logs associated with a batch job.  This API can be called repeatedly to tail the logs " +
      "by passing a checkpoint that acts as a last seen log date.  When polling for additional pages this API " +
      "may return an empty array of log lines.  This may occur when the end of the log stream has been reached " +
      "but the job is still running.  In this case, the API can be called repeatedly with the same checkpoint to " +
      "tail the log stream.  It is recommended that when tailing logs, exponential backoff be applied between " +
      "calls.",
    operationId: "GetBatchJobLogs",
  })
  @ApiTags("Batch")
  @ApiProduces("application/json")
  @ApiParam({
    name: "jobId",
    description: "The ID of the job to describe",
    type: String,
  })
  @ApiQuery({
    name: "checkpoint",
    description: "The point to query from in the log stream",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: GetBatchJobLogsResponse,
    headers: {
      NextPageUrl: {
        description: "The URL for the next page in the results",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Param("jobId") jobId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Query("checkpoint") checkpoint: string,
  ): Promise<GetBatchJobLogsResponse> {
    const id = uuidv4();

    return {
      logs: [
        {
          timestamp: moment(),
          data: "Test",
          level: LogLevel.FATAL,
        },
      ],
      jobId: id,
      lastEventTimestamp: moment(),
    };
  }
}
