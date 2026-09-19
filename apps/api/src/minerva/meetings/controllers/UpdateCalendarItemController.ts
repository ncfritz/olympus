import {
  SingleCalendarItemResponse,
  UpdateCalendarItemRequest,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class UpdateCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Put("/meeting/:meetingId")
  @ApiOperation({
    summary: "Updates an existing calendar item",
    description: "Applies the given changes to a calendar item.",
    operationId: "UpdateCalendarItem",
    tags: ["Meetings"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to update",
    type: String,
  })
  @ApiBody({
    type: UpdateCalendarItemRequest,
    required: true,
    description: "Input for the UpdateCalendarItem operation",
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("meetingId") meetingId: string,
    @Body() request: UpdateCalendarItemRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (Object.keys(request.item).length === 0) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    const responseBody: SingleCalendarItemResponse = {
      item: await this.meetings.update(meetingId, request.item),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
