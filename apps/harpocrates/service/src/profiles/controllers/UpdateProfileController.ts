import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
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
import { AdminOnly } from "../../auth/roles";
import {
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Put("/profile/:profileId")
  @ApiOperation({
    summary: "Updates a profile",
    description:
      "Pins a profile to an issuer, or unpins it; its other rules come from migrations.",
    operationId: "UpdateProfile",
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
    type: UpdateProfileRequest,
    required: true,
    description: "The issuer to pin it to.",
  })
  @ApiOkResponse({
    description: "The profile was updated.",
    type: UpdateProfileResponse,
  })
  @ApiStandardErrorResponses({ include: [HttpStatus.FORBIDDEN] })
  @AdminOnly()
  async handle(
    @Param("profileId") profileId: string,
    @Body() request: UpdateProfileRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateProfileResponse = {
      profile: await this.profiles.update(principal, profileId, request),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
