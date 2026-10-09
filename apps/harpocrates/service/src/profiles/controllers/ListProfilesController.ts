import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { ListProfilesResponse } from "../../model/profiles";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { ProfileService } from "../services/ProfileService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListProfilesController {
  constructor(private readonly profiles: ProfileService) {}

  @Get("/profiles")
  @ApiOperation({
    summary: "Lists the profiles",
    description:
      "Every profile: what its certificates may be, how they are enrolled and which issuer they come from.",
    operationId: "ListProfiles",
    tags: ["Profiles"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The profiles.", type: ListProfilesResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListProfilesResponse = {
      profiles: await this.profiles.list(),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
