import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class DescribeCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meeting/:meetingId")
  @ApiOperation({
    summary: "Gets a single calendar item by ID",
    description: "Gets a single calendar item by ID.",
    operationId: "DescribeCalendarItem",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The calendar item have been successfully fetched.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleCalendarItemResponse = {
      item: await this.meetings.describe(meetingId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
