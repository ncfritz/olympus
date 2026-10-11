import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { ReactivateProfileResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ReactivateProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post("/profile/:profileId/reactivate")
  @ApiOperation({
    summary: "Reactivates a profile",
    description: "New certificates may choose it again.",
    operationId: "ReactivateProfile",
    tags: ["Profiles"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "profileId",
    description: "The profile's name",
    type: String,
  })
  @ApiOkResponse({
    description: "The profile.",
    type: ReactivateProfileResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("profileId") profileId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ReactivateProfileResponse = {
      profile: await this.profiles.reactivate(principal, profileId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
