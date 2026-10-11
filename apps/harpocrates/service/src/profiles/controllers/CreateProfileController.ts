import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { setLocation } from "../../utils/location";
import { DescribeProfileController } from "./DescribeProfileController";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly, RecentSignIn } from "../../auth/roles";
import {
  CreateProfileRequest,
  CreateProfileResponse,
} from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Post("/profiles")
  @ApiOperation({
    summary: "Creates a profile",
    description:
      "A new profile, at v1 (ADR 0034). Its name is its own for good: a deactivated profile keeps it.",
    operationId: "CreateProfile",
    tags: ["Profiles"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateProfileRequest,
    required: true,
    description: "The profile and its settings.",
  })
  @ApiCreatedResponse({
    description: "The profile was created.",
    type: CreateProfileResponse,
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
    @Body() request: CreateProfileRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateProfileResponse = {
      profile: await this.profiles.create(principal, request.profile),
    };
    setLocation(response, httpRequest, DescribeProfileController, {
      profileId: responseBody.profile.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
