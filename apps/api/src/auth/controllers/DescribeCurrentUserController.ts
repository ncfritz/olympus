import { DescribeCurrentUserResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { CurrentPrincipal, RequiresIdentity } from "../authDecorators";
import { type Principal, requireUser } from "../principal";
import { UserDirectoryService } from "../users/UserDirectoryService";

/**
 * Who the caller is, as the directory has them now.
 *
 * Read from the database rather than from the token, which is the whole
 * point of the endpoint: the token's `roles` are a ten-minute-old snapshot,
 * and a client deciding what to show should be looking at the current
 * answer. The cost is one query per call, which is why the guard does not
 * do this on every request.
 */
@Controller({ path: "auth", version: "1" })
export class DescribeCurrentUserController {
  constructor(private readonly users: UserDirectoryService) {}

  @Get("/me")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes the signed-in user",
    description:
      "The user the access token belongs to, with the roles they hold now rather than the ones their token was issued with. Answers 401 if the user has since been disabled or removed, which is sooner than their token expires.",
    operationId: "DescribeCurrentUser",
    tags: ["Authentication"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: () => DescribeCurrentUserResponse,
    description: "The signed-in user.",
  })
  @ApiResponse({
    status: 401,
    description:
      "No access token, one that does not verify, or a user who has since been disabled or removed.",
  })
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const current = await this.users.describe(user.userId);
    if ("reason" in current) {
      // Disabled or deleted since the token was issued. There is no current
      // user to describe, so this is a 401 rather than a 404: the
      // credentials are the thing that is no longer good.
      throw new UnauthorizedException();
    }

    const body: DescribeCurrentUserResponse = {
      user: {
        id: current.user.id,
        displayName: current.user.displayName,
        email: current.user.email,
        roles: current.user.roles,
      },
    };
    response.status(HttpStatus.OK).send(body);
  }
}
