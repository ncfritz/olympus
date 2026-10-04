import { GetAvailabilityResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
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
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class GetAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/availability")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Works out the signed-in user's availability over a range",
    description:
      "Every 15-minute slot of the range (widened to whole slots) at the highest level of what overlaps it: a block wins over every meeting, a meeting counts for the level the user set or else its calendar status's, and nothing is free. Outside the working day only blocks and meetings the user set count; the rest is none. Cancelled meetings, and those of calendars that do not count toward busy, do not count. The range is at most 92 days.",
    operationId: "GetAvailability",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "start",
    description: "An ISO-8601 timestamp: where the range starts",
    required: true,
    type: String,
  })
  @ApiQuery({
    name: "end",
    description: "An ISO-8601 timestamp: where the range ends",
    required: true,
    type: String,
  })
  @ApiQuery({
    name: "dayStart",
    description:
      "When the working day starts, HH:mm in the caller's time zone; 08:00 when absent",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "dayEnd",
    description:
      "When the working day ends, HH:mm in the caller's time zone; 18:00 when absent",
    required: false,
    type: String,
  })
  @ApiQuery({
    name: "includeWeekends",
    description:
      "Whether Saturday and Sunday are working days; false when absent",
    required: false,
    type: Boolean,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which the working day is read in; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: GetAvailabilityResponse,
    description: "The caller's availability over the range.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("start") start: string,
    @Query("end") end: string,
    @Query("dayStart") dayStart: string | undefined,
    @Query("dayEnd") dayEnd: string | undefined,
    @Query("includeWeekends") includeWeekends: string | undefined,
    @HeaderTimezone() timezone: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetAvailabilityResponse = {
      availability: await this.availability.get(user.userId, start, end, {
        timezone,
        dayStart,
        dayEnd,
        includeWeekends,
      }),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
