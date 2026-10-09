import { GetMeetingStatisticsResponse } from "@ncfritz/olympus-model";
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
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class GetMeetingsStatisticsController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meetings/statistics/:start")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets meeting statistics by hour and weekday",
    description:
      "Gets meeting counts by status for each hour of the day and each day of the week over the requested period, in the caller's timezone.",
    operationId: "GetMeetingsStatistics",
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
    type: GetMeetingStatisticsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days", ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: GetMeetingStatisticsResponse =
      await this.meetings.getStatistics(user.userId, tz, start, days);

    response.status(HttpStatus.OK).send(responseBody);
  }
}
