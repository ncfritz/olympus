import { SignOutResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { CurrentPrincipal, RequiresIdentity } from "../authDecorators";
import { type Principal, requireUser } from "../principal";
import { REFRESH_COOKIE, refreshCookieOptions } from "../refreshCookie";
import { UserDirectoryService } from "../users/UserDirectoryService";

/**
 * Signs the caller out of the session it is calling from.
 *
 * Not the same as `RevokeSession` on your own `sid`, which is why it exists
 * separately: the site's refresh token lives in an httpOnly cookie that no
 * script can reach, so only the API can remove it. Revoking without
 * clearing it leaves the browser presenting a dead token on every visit,
 * which reads to the user as a broken site rather than as being signed out.
 *
 * POST, not DELETE: it acts on "my current session", which is not a
 * resource the caller names, and a GET would be triggerable by a link.
 *
 * Idempotent. Signing out of an already-revoked session clears the cookie
 * and answers `signedOut: false` rather than failing — a client retrying a
 * sign-out has got what it wanted either way.
 */
@Controller({ path: "auth", version: "1" })
export class SignOutController {
  private readonly logger = new Logger(SignOutController.name);

  constructor(
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
    private readonly users: UserDirectoryService,
  ) {}

  @Post("/logout")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Signs the caller out of its current session",
    description:
      "Revokes the session the access token was issued from and clears the site's refresh cookie. The access token itself stays valid for its remaining minutes, because authenticating a request does not read the database. Signing out twice is not an error.",
    operationId: "SignOut",
    tags: ["Authentication"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: () => SignOutResponse,
    description: "The session has been ended and the refresh cookie cleared.",
  })
  @ApiResponse({
    status: 401,
    description: "No access token, or one that does not verify.",
  })
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const signedOut = await this.users.revokeSessionForUser(
      user.sessionId,
      user.userId,
    );

    // Cleared whatever the revocation found. A cookie left behind is the
    // failure mode worth avoiding, and the same attributes it was set with,
    // because a browser only replaces a cookie when name, domain and path
    // all match.
    response.clearCookie(
      REFRESH_COOKIE,
      refreshCookieOptions(this.auth.users.publicBaseUrl),
    );

    this.logger.log(
      signedOut
        ? `signed ${user.userId} out of session ${user.sessionId}`
        : `session ${user.sessionId} was already ended for ${user.userId}`,
    );

    const body: SignOutResponse = { signedOut };
    response.status(HttpStatus.OK).send(body);
  }
}
