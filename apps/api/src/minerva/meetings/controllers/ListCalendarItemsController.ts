import { ListCalendarItemsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
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
export class ListCalendarItemsController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meetings/:start")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists calendar items for a period",
    description:
      "Lists the calendar items that overlap the given days, from the start of the first to the end of the last in the caller's timezone. A deleted item is not listed; a cancelled one is.",
    operationId: "ListCalendarItems",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The first day, YYYY-MM-DD",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to list, 1 to 92; 1 when absent",
    required: false,
    type: Number,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    description: "The IANA timezone the days are read in; Etc/UTC when absent",
  })
  @ApiOkResponse({
    description: "The calendar items have been successfully fetched.",
    type: ListCalendarItemsResponse,
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
    @Query("days", new DefaultValuePipe(1), ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: ListCalendarItemsResponse = {
      items: await this.meetings.list(user.userId, tz, start, days),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
