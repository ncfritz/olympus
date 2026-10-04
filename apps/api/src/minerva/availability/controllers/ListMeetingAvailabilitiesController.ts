import { ListMeetingAvailabilitiesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  AvailabilityService,
  MEETING_IDS_MAX,
} from "../services/AvailabilityService";

@Controller({ version: "1" })
export class ListMeetingAvailabilitiesController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/meeting-availabilities")
  @RequiresIdentity()
  @ApiOperation({
    summary:
      "Lists the level each of some of the signed-in user's meetings counts for",
    description: `The caller's meetings among those named, in the order named, each with its calendar status and the level it counts for. A meeting that is not the caller's is left out. At most ${MEETING_IDS_MAX} meetings.`,
    operationId: "ListMeetingAvailabilities",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "meetingIds",
    description: "The IDs of the meetings, comma-separated",
    required: true,
    type: String,
  })
  @ApiOkResponse({
    type: ListMeetingAvailabilitiesResponse,
    description: "The caller's meetings among those named.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("meetingIds") meetingIds: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMeetingAvailabilitiesResponse = {
      meetings: await this.availability.listMeetings(user.userId, meetingIds),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
