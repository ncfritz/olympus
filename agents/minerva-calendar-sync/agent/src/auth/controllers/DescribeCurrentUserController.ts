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

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCurrentUserController {
  @Get("/auth/current-user")
  @ApiOperation({
    summary: "Describes the current user",
    description: "Returns the signed-in user the access token belongs to.",
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
      user: { email: user.email },
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
