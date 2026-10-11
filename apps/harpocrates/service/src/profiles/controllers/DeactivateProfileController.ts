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
import { DeactivateProfileResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeactivateProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post("/profile/:profileId/deactivate")
  @ApiOperation({
    summary: "Deactivates a profile",
    description:
      "The soft delete: no new certificate may choose it; what was issued under it renews as before.",
    operationId: "DeactivateProfile",
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
    type: DeactivateProfileResponse,
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
    const responseBody: DeactivateProfileResponse = {
      profile: await this.profiles.deactivate(principal, profileId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
