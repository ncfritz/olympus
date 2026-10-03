import { SingleCalendarItemResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class DescribeCalendarItemController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meeting/:meetingId")
  @RequiresIdentity()
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("meetingId") meetingId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: SingleCalendarItemResponse = {
      item: await this.meetings.describe(user.userId, meetingId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
