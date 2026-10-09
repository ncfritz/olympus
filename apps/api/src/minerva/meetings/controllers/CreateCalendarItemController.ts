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
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeCalendarItemController } from "./DescribeCalendarItemController";
import { setLocation } from "../../../utils/location";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class CreateCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Post("/meetings")
  @RequiresIdentity()
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateCalendarItemRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const createdMeeting: Meeting = await this.meetings.create(
      user.userId,
      request.item,
    );

    const responseBody: SingleCalendarItemResponse = {
      item: createdMeeting,
    };

    setLocation(response, httpRequest, DescribeCalendarItemController, {
      meetingId: createdMeeting.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
