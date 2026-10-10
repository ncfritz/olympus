import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { DescribeCurrentUserResponse } from "../../model/auth";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CurrentPrincipal } from "../currentPrincipal";
import type { AuthenticatedRequest, Principal } from "../principal";
import { SignedIn } from "../roles";
import { ConsoleAuthService } from "../services/ConsoleAuthService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeCurrentUserController {
  constructor(private readonly consoleAuth: ConsoleAuthService) {}

  @Get("/auth/current-user")
  @ApiOperation({
    summary: "Describes the current user",
    description:
      "Returns the signed-in Olympus user: their email, as the Olympus API describes them now, and their Harpocrates roles, from the access token. Anyone signed in may ask, whatever their roles, so the CA console can say what it offers them.",
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
    include: [HttpStatus.SERVICE_UNAVAILABLE],
  })
  @SignedIn()
  async handle(
    @CurrentPrincipal() principal: Principal,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeCurrentUserResponse = {
      user: await this.consoleAuth.currentUser(
        principal,
        request.accessToken ?? "",
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
