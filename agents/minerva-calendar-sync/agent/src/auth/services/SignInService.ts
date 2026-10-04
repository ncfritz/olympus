import {
  AuthFlowError,
  authorizeUrl,
  createPkce,
  exchangeCode,
  refreshTokens,
  type IssuedTokens,
} from "@ncfritz/olympus-auth-flow";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { OLYMPUS_CLIENT_ID } from "../authConstants";
import { publishedUrl } from "../publishedUrl";
import { sanitizeReturnTo } from "../sanitizeReturnTo";
import type { SessionTokens } from "../sessionCookie";
import { OlympusApiService } from "./OlympusApiService";

/** The in-flight sign-in, kept in a short-lived cookie between login and callback. */
export interface SignInTransaction {
  state: string;
  verifier: string;
  /** Where to send the browser afterwards; absent, the tokens are answered as JSON. */
  returnTo?: string;
}

/** What the session list shows for this console's sessions. */
const DEVICE_NAME = "Minerva calendar console";

/**
 * How long a refresh's answer is kept for the requests that presented the
 * same refresh token. The console asks for several things at once, and
 * until the first answer's cookies arrive every one of them carries the
 * old token: presented twice, the API takes it for a stolen one and ends
 * the session (ADR 0018). So the agent refreshes once and gives them all
 * the same answer.
 */
const REFRESH_REUSE_MS = 30_000;

const base64Url = (bytes: Buffer) => bytes.toString("base64url");
const pkce = createPkce({
  randomBase64Url: (length) => base64Url(randomBytes(length)),
  sha256Base64Url: (text) =>
    base64Url(createHash("sha256").update(text).digest()),
});

/**
 * The console's sign-in through Olympus (ADR 0029): the authorization-code
 * flow with PKCE against the API's sign-in, completed by the agent at
 * `<AUTH_BASE_URL>/auth/callback`, and the refresh that keeps it going.
 */
@Injectable()
export class SignInService {
  private readonly logger = new Logger(SignInService.name);
  private readonly baseUrl: string;
  private readonly signInUrl: string;
  private readonly webAppUrl?: string;
  private readonly refreshes = new Map<
    string,
    { answer: Promise<SessionTokens>; settledAt?: number }
  >();

  constructor(
    private readonly api: OlympusApiService,
    @Inject(authConfig.KEY) auth: AuthConfigType,
  ) {
    this.baseUrl = auth.baseUrl;
    this.signInUrl = auth.olympus.signInUrl;
    this.webAppUrl = auth.webAppUrl;
  }

  /** Where the browser goes to sign in with `provider`, and the transaction to keep until it is back. */
  async start(
    provider: string,
    returnTo: string | undefined,
  ): Promise<{ url: string; transaction: SignInTransaction }> {
    const verifier = await pkce.newVerifier();
    const state = await pkce.newState();
    const url = authorizeUrl(`${this.signInUrl}/v1`, {
      clientId: OLYMPUS_CLIENT_ID,
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
        returnTo: sanitizeReturnTo(returnTo, this.webAppUrl),
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
        clientId: OLYMPUS_CLIENT_ID,
        verifier: transaction.verifier,
        deviceName: DEVICE_NAME,
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
   * together. @throws UnauthorizedException when the API will not refresh
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
      answer: refreshTokens(this.api.postForm, {
        clientId: OLYMPUS_CLIENT_ID,
        refreshToken,
      })
        .then(session)
        .catch((error: unknown) => {
          this.logger.warn(
            `refresh refused: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw new UnauthorizedException(
            "The session has ended: sign in again",
          );
        })
        .finally(() => {
          entry.settledAt = Date.now();
        }),
    };
    this.refreshes.set(key, entry);
    return entry.answer;
  }

  /** Registered with the API's client registry; nginx publishes it under the console. */
  private callbackUrl(): string {
    return publishedUrl(this.baseUrl, "auth/callback").href;
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
