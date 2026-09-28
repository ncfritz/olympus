import { TesterError } from "./errors";
import { CODE_CHALLENGE_METHOD } from "./pkce";

export type IssuedTokens = {
  accessToken: string;
  /** Seconds, as the API reports them. */
  expiresIn: number;
  refreshToken: string;
};

/** What a form-encoded POST to the token endpoint came back with. */
export type FormAnswer = {
  status: number;
  body: unknown;
  headers: Record<string, string | undefined>;
};

/** How the token endpoint is spoken to; the HTTP is somebody else's job. */
export type FormPost = (
  path: string,
  form: Record<string, string>,
) => Promise<FormAnswer>;

/**
 * Where the browser is sent to start a sign-in.
 *
 * Built here rather than by the API, because this is the half a client owns:
 * its own `state`, its own PKCE challenge, and a `redirect_uri` that must
 * match what it registered, character for character.
 */
export const authorizeUrl = (
  apiBaseUrl: string,
  request: {
    clientId: string;
    redirectUri: string;
    challenge: string;
    state: string;
    provider: string;
  },
): string => {
  const url = new URL(`${apiBaseUrl.replace(/\/+$/, "")}/auth/authorize`);
  url.searchParams.set("client_id", request.clientId);
  url.searchParams.set("redirect_uri", request.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", request.challenge);
  url.searchParams.set("code_challenge_method", CODE_CHALLENGE_METHOD);
  url.searchParams.set("state", request.state);
  url.searchParams.set("provider", request.provider);
  return url.href;
};

/** RFC 6749 §4.1.3: the authorization code for tokens. */
export const exchangeCode = async (
  post: FormPost,
  request: {
    code: string;
    redirectUri: string;
    clientId: string;
    verifier: string;
    deviceName: string;
  },
): Promise<IssuedTokens> =>
  issued(
    await post("/auth/token", {
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: request.clientId,
      code_verifier: request.verifier,
      device_name: request.deviceName,
    }),
  );

/** RFC 6749 §6, and rotation: the token that comes back replaces this one. */
export const refreshTokens = async (
  post: FormPost,
  request: { clientId: string; refreshToken: string },
): Promise<IssuedTokens> =>
  issued(
    await post("/auth/token", {
      grant_type: "refresh_token",
      client_id: request.clientId,
      refresh_token: request.refreshToken,
    }),
  );

/**
 * The same request as `refreshTokens`, without the expectation that it works:
 * `refresh --replay` needs the refusal itself, and the OAuth error code in it.
 */
export const attemptRefresh = (
  post: FormPost,
  request: { clientId: string; refreshToken: string },
): Promise<FormAnswer> =>
  post("/auth/token", {
    grant_type: "refresh_token",
    client_id: request.clientId,
    refresh_token: request.refreshToken,
  });

/** `{ error, error_description }` as RFC 6749 §5.2 defines it. */
export const oauthError = (
  answer: FormAnswer,
): { error: string; description?: string } | undefined => {
  const body = answer.body;
  if (typeof body !== "object" || body === null) return undefined;
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== "string") return undefined;
  const description = (body as Record<string, unknown>).error_description;
  return {
    error,
    ...(typeof description === "string" ? { description } : {}),
  };
};

const issued = (answer: FormAnswer): IssuedTokens => {
  if (answer.status === 429) {
    const retry = answer.headers["retry-after"];
    throw new TesterError(
      `the API is rate limiting the token endpoint${
        retry === undefined ? "" : `; try again in ${retry}s`
      }`,
    );
  }
  const refused = oauthError(answer);
  if (refused !== undefined) {
    throw new TesterError(
      `the API refused: ${refused.error}${
        refused.description === undefined ? "" : ` (${refused.description})`
      }`,
    );
  }
  if (answer.status !== 200) {
    throw new TesterError(
      `the token endpoint answered ${answer.status}: ${JSON.stringify(answer.body)}`,
    );
  }

  const body = (answer.body ?? {}) as Record<string, unknown>;
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  const expiresIn = body.expires_in;
  if (typeof accessToken !== "string" || typeof expiresIn !== "number") {
    throw new TesterError(
      "the token endpoint answered 200 without an access token",
    );
  }
  if (typeof refreshToken !== "string") {
    // This client is registered for refresh tokens in the body. Getting none
    // means it has been changed to the cookie delivery the site uses, which
    // a CLI cannot hold.
    throw new TesterError(
      "no refresh token in the response: this client is configured to receive it in a cookie",
    );
  }
  return { accessToken, expiresIn, refreshToken };
};
