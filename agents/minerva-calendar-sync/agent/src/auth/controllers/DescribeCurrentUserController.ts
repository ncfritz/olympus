import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeCurrentUserResponse } from "../../model/auth";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import type { AuthUser } from "../authUser";
import { CurrentUser } from "../currentUser";
import { SessionService } from "../services/SessionService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCurrentUserController {
  constructor(private readonly sessions: SessionService) {}

  @Get("/auth/current-user")
  @ApiOperation({
    summary: "Describes the current user",
    description:
      "Returns the signed-in Olympus user the access token belongs to, as the Olympus API describes them now.",
    operationId: "DescribeCurrentUser",
    tags: ["Auth"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The user is signed in.",
    type: DescribeCurrentUserResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCurrentUserResponse = {
      user: await this.sessions.describe(user),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
