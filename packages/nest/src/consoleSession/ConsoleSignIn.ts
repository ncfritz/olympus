import {
  AuthFlowError,
  attemptRefresh,
  authorizeUrl,
  createPkce,
  exchangeCode,
  oauthError,
  type FormAnswer,
  type IssuedTokens,
} from "@ncfritz/olympus-auth-flow";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { publishedUrl } from "../auth/publishedUrl";
import { sanitizeReturnTo } from "../auth/sanitizeReturnTo";
import { CONSOLE_SESSION_CONFIG, type ConsoleSessionConfig } from "./config";
import type { SessionTokens } from "./cookies";
import { OlympusAuthApi } from "./OlympusAuthApi";

/** The in-flight sign-in, kept in a short-lived cookie between login and callback. */
export interface SignInTransaction {
  state: string;
  verifier: string;
  /** Where to send the browser afterwards; absent, the tokens are answered as JSON. */
  returnTo?: string;
}

/**
 * How long a refresh's answer is kept for the requests that presented the
 * same refresh token. The console asks for several things at once, and
 * until the first answer's cookies arrive every one of them carries the
 * old token: presented twice, the API takes it for a stolen one and ends
 * the session (ADR 0018). So the service refreshes once and gives them all
 * the same answer — for as long as that race lasts and no longer, since
 * for that long the old token is as good as the new one.
 */
const REFRESH_REUSE_MS = 10_000;

/** The API's refusals that mean the refresh token is no good, as opposed to the API being unable to say. */
const SESSION_ENDED = new Set([
  "invalid_grant",
  "invalid_client",
  "invalid_request",
  "unauthorized_client",
]);

const base64Url = (bytes: Buffer) => bytes.toString("base64url");
const pkce = createPkce({
  randomBase64Url: (length) => base64Url(randomBytes(length)),
  sha256Base64Url: (text) =>
    base64Url(createHash("sha256").update(text).digest()),
});

/**
 * The console's sign-in through Olympus (ADR 0029): the authorization-code
 * flow with PKCE against the API's sign-in, completed by the console's
 * service at `<baseUrl>/auth/callback`, and the refresh that keeps it
 * going.
 */
@Injectable()
export class ConsoleSignIn {
  private readonly logger = new Logger(ConsoleSignIn.name);
  private readonly refreshes = new Map<
    string,
    { answer: Promise<SessionTokens>; settledAt?: number }
  >();

  constructor(
    private readonly api: OlympusAuthApi,
    @Inject(CONSOLE_SESSION_CONFIG)
    private readonly config: ConsoleSessionConfig,
  ) {}

  /** Where the browser goes to sign in with `provider`, and the transaction to keep until it is back. */
  async start(
    provider: string,
    returnTo: string | undefined,
  ): Promise<{ url: string; transaction: SignInTransaction }> {
    const verifier = await pkce.newVerifier();
    const state = await pkce.newState();
    const url = authorizeUrl(`${this.config.olympus.signInUrl}/v1`, {
      clientId: this.config.clientId,
      redirectUri: this.callbackUrl(),
      challenge: await pkce.challengeFor(verifier),
      state,
      provider,
    });
    return {
      url,
      transaction: {
        state,
        verifier,
        returnTo: sanitizeReturnTo(returnTo, this.config.webAppUrl),
      },
    };
  }

  /**
   * The callback's code for the user's tokens. Whether the user may use
   * the console is the guard's question, asked of every request; this only
   * completes the sign-in. @throws BadRequestException
   */
  async complete(
    rawTransaction: string | undefined,
    query: { code?: string; state?: string; error?: string },
  ): Promise<SessionTokens & { returnTo?: string }> {
    const transaction = readTransaction(rawTransaction);
    if (query.error) {
      throw new BadRequestException(
        `Olympus refused the sign-in: ${query.error}`,
      );
    }
    if (!query.state || query.state !== transaction.state) {
      throw new BadRequestException(
        "The sign-in's state does not match: start over at /auth/login",
      );
    }
    if (!query.code) {
      throw new BadRequestException("The sign-in came back without a code");
    }
    try {
      const issued = await exchangeCode(this.api.postForm, {
        code: query.code,
        redirectUri: this.callbackUrl(),
        clientId: this.config.clientId,
        verifier: transaction.verifier,
        deviceName: this.config.deviceName,
      });
      return { ...session(issued), returnTo: transaction.returnTo };
    } catch (error) {
      if (error instanceof AuthFlowError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * New tokens for a refresh token, once however many requests present it
   * together. @throws UnauthorizedException when the API says the session
   * has ended, ServiceUnavailableException when it cannot say (unreachable,
   * failing, rate limiting), which is not remembered
   */
  refresh(refreshToken: string): Promise<SessionTokens> {
    const now = Date.now();
    for (const [key, entry] of this.refreshes) {
      if (
        entry.settledAt !== undefined &&
        now - entry.settledAt > REFRESH_REUSE_MS
      ) {
        this.refreshes.delete(key);
      }
    }
    // Keyed by its hash: the map outlives the request, the token need not.
    const key = createHash("sha256").update(refreshToken).digest("base64url");
    const pending = this.refreshes.get(key);
    if (pending) return pending.answer;

    const entry: { answer: Promise<SessionTokens>; settledAt?: number } = {
      answer: this.attempt(refreshToken).then(
        (tokens) => {
          entry.settledAt = Date.now();
          return tokens;
        },
        (error: unknown) => {
          if (error instanceof UnauthorizedException) {
            entry.settledAt = Date.now();
          } else {
            this.refreshes.delete(key);
          }
          throw error;
        },
      ),
    };
    this.refreshes.set(key, entry);
    return entry.answer;
  }

  private async attempt(refreshToken: string): Promise<SessionTokens> {
    let answer: FormAnswer;
    try {
      answer = await attemptRefresh(this.api.postForm, {
        clientId: this.config.clientId,
        refreshToken,
      });
    } catch (error) {
      this.logger.warn(
        `refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        "The Olympus API cannot be reached",
      );
    }

    const refused = oauthError(answer);
    if (refused && SESSION_ENDED.has(refused.error)) {
      this.logger.log(`refresh refused: ${refused.error}`);
      throw new UnauthorizedException("The session has ended: sign in again");
    }
    const body = (answer.body ?? {}) as Record<string, unknown>;
    if (
      answer.status !== 200 ||
      typeof body.access_token !== "string" ||
      typeof body.expires_in !== "number" ||
      typeof body.refresh_token !== "string"
    ) {
      this.logger.warn(
        `refresh answered ${answer.status}${refused ? ` (${refused.error})` : ""}`,
      );
      throw new ServiceUnavailableException(
        "The Olympus API could not refresh the session just now",
      );
    }
    return {
      accessToken: body.access_token,
      expiresIn: body.expires_in,
      refreshToken: body.refresh_token,
    };
  }

  /** Registered with the API's client registry; nginx publishes it under the console. */
  private callbackUrl(): string {
    return publishedUrl(this.config.baseUrl, "auth/callback").href;
  }
}

const session = (issued: IssuedTokens): SessionTokens => ({
  accessToken: issued.accessToken,
  expiresIn: issued.expiresIn,
  refreshToken: issued.refreshToken,
});

const readTransaction = (raw: string | undefined): SignInTransaction => {
  if (!raw) {
    throw new BadRequestException(
      "Missing or expired sign-in: start over at /auth/login",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException("Malformed sign-in cookie");
  }
  const txn = parsed as Partial<SignInTransaction>;
  if (typeof txn?.state !== "string" || typeof txn.verifier !== "string") {
    throw new BadRequestException("Malformed sign-in cookie");
  }
  return {
    state: txn.state,
    verifier: txn.verifier,
    returnTo: typeof txn.returnTo === "string" ? txn.returnTo : undefined,
  };
};
