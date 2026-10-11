import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  MoveProfileEnrollmentsRequest,
  MoveProfileEnrollmentsResponse,
} from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class MoveProfileEnrollmentsController {
  constructor(private readonly profiles: ProfileService) {}

  @Post("/profile/:profileId/move")
  @ApiOperation({
    summary: "Moves certificates to a profile version",
    description:
      "The enrollments of the given certificates, issued under this profile, move to one of its versions: their next renewal uses it.",
    operationId: "MoveProfileEnrollments",
    tags: ["Profiles"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "profileId",
    description: "The profile's name",
    type: String,
  })
  @ApiBody({
    type: MoveProfileEnrollmentsRequest,
    required: true,
    description: "The certificates, and the version.",
  })
  @ApiOkResponse({
    description: "How many moved.",
    type: MoveProfileEnrollmentsResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.UNPROCESSABLE_ENTITY],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("profileId") profileId: string,
    @Body() request: MoveProfileEnrollmentsRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: MoveProfileEnrollmentsResponse = {
      moved: await this.profiles.moveEnrollments(principal, profileId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
