import { ListSessionsResponse, UserSession } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import moment from "moment";
import { CurrentPrincipal, RequiresIdentity } from "../authDecorators";
import { type Principal, requireUser } from "../principal";
import {
  type ListedSession,
  UserDirectoryService,
} from "../users/UserDirectoryService";

/**
 * The caller's own sessions — every device they are signed in on.
 *
 * Whose sessions is never a parameter. It comes from the access token's
 * `sub`, so there is no version of this request that asks for somebody
 * else's.
 */
@Controller({ path: "auth", version: "1" })
export class ListSessionsController {
  constructor(private readonly users: UserDirectoryService) {}

  @Get("/sessions")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's sessions",
    description:
      "Every session of the caller's that has not been revoked or expired, newest first, with the one the request was made from marked `current`. Nothing here identifies a refresh token.",
    operationId: "ListSessions",
    tags: ["Authentication"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: () => ListSessionsResponse,
    description: "The caller's live sessions.",
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
    const sessions = await this.users.listSessions(user.userId);

    const body: ListSessionsResponse = {
      sessions: sessions.map((session) => session_(session, user.sessionId)),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

/** A row as the API publishes it: no token, no hash, and `current` resolved. */
const session_ = (
  row: ListedSession,
  currentSessionId: string,
): UserSession => ({
  id: row.id,
  clientId: row.clientId,
  ...(row.deviceName === null ? {} : { deviceName: row.deviceName }),
  // From the caller's own `sid`, so "this device" is whatever made the
  // request rather than a guess from the user agent.
  current: row.id === currentSessionId,
  createdTime: moment.utc(row.createdTime),
  ...(row.lastUsedTime === null
    ? {}
    : { lastUsedTime: moment.utc(row.lastUsedTime) }),
  expiresTime: moment.utc(row.expiresTime),
});
