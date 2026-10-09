import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { CurrentUser } from "../../model/auth";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../authConstants";
import type { AuthUser } from "../authUser";
import { OlympusApiService } from "./OlympusApiService";
import { OlympusTokenVerifier } from "./OlympusTokenVerifier";
import { SignInService } from "./SignInService";

/** The signed-in user's Olympus session, as far as the agent takes part in it. */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly api: OlympusApiService,
    private readonly verifier: OlympusTokenVerifier,
    private readonly signIn: SignInService,
  ) {}

  /**
   * Who the user is, from the API: the token carries an ID and roles, and
   * the console shows an email. @throws UnauthorizedException when the API
   * no longer knows them, ServiceUnavailableException when it cannot say
   */
  async describe(user: AuthUser): Promise<CurrentUser> {
    let answer;
    try {
      answer = await this.api.describeUser(user.accessToken);
    } catch (error) {
      throw new ServiceUnavailableException(
        "The Olympus API cannot be reached",
        {
          cause: error,
        },
      );
    }
    const described = (
      answer.body as { user?: { email?: unknown } } | undefined
    )?.user;
    if (answer.status === 401) {
      throw new UnauthorizedException("Olympus no longer knows this user");
    }
    if (answer.status !== 200 || typeof described?.email !== "string") {
      throw new ServiceUnavailableException(
        `The Olympus API answered ${answer.status} for the current user`,
      );
    }
    return { email: described.email };
  }

  /**
   * Ends the browser's Olympus session, so signing out of the console is not
   * undone by its refresh token. Best effort: the cookies are cleared
   * whatever the API says, and an access token already issued lives out its
   * minutes (ADR 0018).
   */
  async end(request: Request): Promise<void> {
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    try {
      let token = cookies?.[ACCESS_TOKEN_COOKIE];
      if (token && "reason" in (await this.verifier.verify(token))) {
        token = undefined;
      }
      const refresh = cookies?.[REFRESH_TOKEN_COOKIE];
      if (!token && refresh) {
        token = (await this.signIn.refresh(refresh)).accessToken;
      }
      if (!token) return;
      const answer = await this.api.signOut(token);
      if (answer.status !== 200) {
        this.logger.warn(`signing out answered ${answer.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `could not end the Olympus session: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
