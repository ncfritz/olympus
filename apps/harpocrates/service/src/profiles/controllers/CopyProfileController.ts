import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { setLocation } from "../../utils/location";
import { DescribeProfileController } from "./DescribeProfileController";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import { CopyProfileRequest, CopyProfileResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CopyProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post("/profile/:profileId/copy")
  @ApiOperation({
    summary: "Copies a profile",
    description:
      "A new profile whose v1 is a version of this one (its latest, by default).",
    operationId: "CopyProfile",
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
    type: CopyProfileRequest,
    required: true,
    description: "The new profile's name, and which version to copy.",
  })
  @ApiCreatedResponse({
    description: "The new profile.",
    type: CopyProfileResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The profile" },
    },
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
    ],
  })
  @AdminOnly()
  @RecentSignIn()
  async handle(
    @Param("profileId") profileId: string,
    @Body() request: CopyProfileRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CopyProfileResponse = {
      profile: await this.profiles.copy(principal, profileId, request),
    };
    setLocation(response, httpRequest, DescribeProfileController, {
      profileId: responseBody.profile.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
