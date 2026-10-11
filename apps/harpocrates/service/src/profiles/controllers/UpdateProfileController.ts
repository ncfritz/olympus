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
import { AdminOnly, RecentSignIn } from "../../auth/roles";
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
    summary: "Edits a profile",
    description:
      "What is given changes, the rest carries over. A change of settings makes the profile's next version, which new certificates take; what was issued under an earlier one renews under it. The description alone makes no version.",
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
    description: "What changes.",
  })
  @ApiOkResponse({
    description: "The profile, as its latest version.",
    type: UpdateProfileResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.UNPROCESSABLE_ENTITY],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("profileId") profileId: string,
    @Body() request: UpdateProfileRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateProfileResponse = {
      profile: await this.profiles.update(
        principal,
        profileId,
        request.profile,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
