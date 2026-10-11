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
import { ListProfileVersionsResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListProfileVersionsController {
  constructor(private readonly profiles: ProfileService) {}

  @Get("/profile/:profileId/versions")
  @ApiOperation({
    summary: "Lists a profile's versions",
    description:
      "Every version of a profile, newest first: each one's settings, who made it and when (ADR 0034).",
    operationId: "ListProfileVersions",
    tags: ["Profiles"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "profileId",
    description: "The profile's name",
    type: String,
  })
  @ApiOkResponse({
    description: "The versions.",
    type: ListProfileVersionsResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Param("profileId") profileId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListProfileVersionsResponse = {
      versions: await this.profiles.versions(profileId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
