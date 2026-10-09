import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class ClearMeetingAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Delete("/meeting/:meetingId/availability")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Clears the level the signed-in user set for a meeting",
    description:
      "The meeting goes back to counting for its calendar status's level. Clearing a level that is not set changes nothing.",
    operationId: "ClearMeetingAvailability",
    tags: ["Availability"],
  })
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting",
    type: String,
  })
  @ApiNoContentResponse({
    description: "The meeting counts for its calendar status's level.",
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
    await this.availability.clearMeetingLevel(user.userId, meetingId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}
