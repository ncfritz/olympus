import { RevokeSessionResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";
import { CurrentPrincipal, RequiresIdentity } from "../authDecorators";
import { type Principal, requireUser } from "../principal";
import { UserDirectoryService } from "../users/UserDirectoryService";

/**
 * Ends one of the caller's own sessions.
 *
 * The user has to own it: the update matches on the session id *and* the
 * caller's id, so this cannot end somebody else's session even with their
 * session id in hand. A session that is not theirs answers exactly as one
 * that does not exist, because telling those apart would confirm that an id
 * belongs to someone.
 *
 * Revoking takes effect at the next refresh, not immediately: the access
 * token already issued stays valid for its remaining minutes, because the
 * guard does not read the database (ADR 0018). "Sign out everywhere" is
 * therefore up to ten minutes, not instant, and that is the trade the ADR
 * made for a free authentication check.
 */
@Controller({ path: "auth", version: "1" })
export class RevokeSessionController {
  private readonly logger = new Logger(RevokeSessionController.name);

  constructor(private readonly users: UserDirectoryService) {}

  @Delete("/sessions/:sessionId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Revokes one of the signed-in user's sessions",
    description:
      "Ends a session of the caller's, so its refresh token stops working. An access token already issued from it stays valid until it expires, within ten minutes. A session that is not the caller's answers 404, exactly as a session that does not exist.",
    operationId: "RevokeSession",
    tags: ["Authentication"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "sessionId",
    description: "The id of the session to revoke, from ListSessions",
    type: String,
  })
  @ApiOkResponse({
    type: () => RevokeSessionResponse,
    description: "The session has been revoked.",
  })
  @ApiResponse({
    status: 401,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("sessionId") sessionId: string,
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    if (!(await this.users.revokeSessionForUser(sessionId, user.userId))) {
      // No such session, not theirs, or already revoked: one answer for all
      // three.
      throw new NotFoundException();
    }

    const signedOutThisDevice = sessionId === user.sessionId;
    this.logger.log(
      `user ${user.userId} revoked session ${sessionId}${
        signedOutThisDevice ? " (their own)" : ""
      }`,
    );

    const body: RevokeSessionResponse = { sessionId, signedOutThisDevice };
    response.status(HttpStatus.OK).send(body);
  }
}
