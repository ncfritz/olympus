import {
  SetMeetingAvailabilityRequest,
  SingleMeetingAvailabilityResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class SetMeetingAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Put("/meeting/:meetingId/availability")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Sets the level one of the signed-in user's meetings counts for",
    description:
      "The meeting counts for this level whatever its calendar says, outside the working day too. Another user's meeting is not found.",
    operationId: "SetMeetingAvailability",
    tags: ["Availability"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting",
    type: String,
  })
  @ApiBody({
    type: SetMeetingAvailabilityRequest,
    required: true,
    description: "Input for the SetMeetingAvailability operation",
  })
  @ApiOkResponse({
    type: SingleMeetingAvailabilityResponse,
    description: "The meeting, with the level it now counts for.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("meetingId") meetingId: string,
    @Body() request: SetMeetingAvailabilityRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: SingleMeetingAvailabilityResponse = {
      meeting: await this.availability.setMeetingLevel(
        user.userId,
        meetingId,
        request?.availability?.status,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}
