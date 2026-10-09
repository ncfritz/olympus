import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { DescribeProfileResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get("/profile/:profileId")
  @ApiOperation({
    summary: "Describes a profile",
    description: "One profile and its rules.",
    operationId: "DescribeProfile",
    tags: ["Profiles"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "profileId",
    description: "The profile's name",
    type: String,
  })
  @ApiOkResponse({ description: "The profile.", type: DescribeProfileResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("profileId") profileId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeProfileResponse = {
      profile: await this.profiles.describe(profileId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
