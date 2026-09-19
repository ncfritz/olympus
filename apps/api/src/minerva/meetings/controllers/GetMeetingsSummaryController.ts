import { GetMeetingSummaryResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class GetMeetingsSummaryController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meetings/summary/:start")
  @ApiOperation({
    summary: "Gets a daily summary of meetings",
    description:
      "Gets meeting counts by status for each day of the requested period, in the caller's timezone.",
    operationId: "GetMeetingsSummary",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The start date to get statistics for",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch statistics for",
    type: Number,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    description: "The IANA timezone to execute the query in",
  })
  @ApiOkResponse({
    description: "Monthly summary fetched.",
    type: GetMeetingSummaryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days", ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetMeetingSummaryResponse =
      await this.meetings.getSummary(tz, start, days);

    response.status(HttpStatus.OK).send(responseBody);
  }
}
