import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
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
export class DeleteCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Delete("/meeting/:meetingId")
  @ApiOperation({
    summary: "Soft deletes an existing meeting",
    description: "Soft deletes a meeting.",
    operationId: "DeleteCalendarItem",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to delete",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleCalendarItemResponse = {
      item: await this.meetings.delete(meetingId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
