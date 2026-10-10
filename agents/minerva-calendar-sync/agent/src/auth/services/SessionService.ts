import { ConsoleSession } from "@ncfritz/olympus-nest";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { CurrentUser } from "../../model/auth";
import type { AuthUser } from "../authUser";
import { OlympusTokenVerifier } from "./OlympusTokenVerifier";

/** The signed-in user's Olympus session, as far as the agent takes part in it. */
@Injectable()
export class SessionService {
  constructor(
    private readonly session: ConsoleSession,
    private readonly verifier: OlympusTokenVerifier,
  ) {}

  /**
   * Who the user is, from the API: the token carries an ID and roles, and
   * the console shows an email. @throws UnauthorizedException when the API
   * no longer knows them, ServiceUnavailableException when it cannot say
   */
  describe(user: AuthUser): Promise<CurrentUser> {
    return this.session.describe(user.accessToken);
  }

  /**
   * Ends the browser's Olympus session, so signing out of the console is not
   * undone by its refresh token. Best effort: the cookies are cleared
   * whatever the API says, and an access token already issued lives out its
   * minutes (ADR 0018).
   */
  end(request: Request): Promise<void> {
    return this.session.end(request, (token) => this.verifier.verify(token));
  }
}
