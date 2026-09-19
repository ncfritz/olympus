import {
  CreateCalendarItemRequest,
  Meeting,
  SingleCalendarItemResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeCalendarItemController } from "./DescribeCalendarItemController";
import { setLocation } from "../../../utils/location";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class CreateCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Post("/meetings")
  @ApiOperation({
    summary: "Creates a new calendar item",
    description: "Creates a new calendar item.",
    operationId: "CreateCalendarItem",
    tags: ["Meetings"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCalendarItemRequest,
    required: true,
    description: "Input for the CreateCalendarItemRequest operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleCalendarItemResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCalendarItemRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdMeeting: Meeting = await this.meetings.create(request.item);

    const responseBody: SingleCalendarItemResponse = {
      item: createdMeeting,
    };

    setLocation(response, httpRequest, DescribeCalendarItemController, {
      meetingId: createdMeeting.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
