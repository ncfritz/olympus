import {
  afterIssue,
  authorizeUrl,
  base64ToBase64Url,
  createPkce,
  decodeToken,
  encodeBase64Url,
  exchangeCode,
  type FlowCrypto,
  type FormAnswer,
  type FormPost,
  formBody,
  parseRedirect,
  type SavedTokens,
} from "@ncfritz/olympus-auth-flow";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

/**
 * The client the API registered for this tester, and the redirect URI
 * registered with it. Both are matched exactly, so neither is configurable:
 * `apps/api/src/auth/clients/clients.ts` is where they are agreed.
 */
export const CLIENT_ID = "olympus-auth-tester";
export const REDIRECT_URI = "olympus-auth-tester://auth";

/** The only provider the API has configured. */
export const PROVIDER = "google";

/** The platform's half of PKCE: randomness and SHA-256, both as base64url. */
const expoCrypto: FlowCrypto = {
  randomBase64Url: async (bytes) =>
    encodeBase64Url(await Crypto.getRandomBytesAsync(bytes)),
  // expo-crypto digests to hex by default and to padded base64 on request;
  // neither is base64url, so the challenge is converted rather than hoped for.
  sha256Base64Url: async (text) =>
    base64ToBase64Url(
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        text,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      ),
    ),
};

/**
 * The token endpoint over `fetch`, form-encoded as RFC 6749 wants.
 *
 * Not through `@ncfritz/olympus-client`: that carries an access token, and this
 * is the call that issues one. It still names itself with `X-Olympus-Client`
 * (ADR 0017), so the API's metrics can tell this tester from the site.
 */
export const formPoster =
  (apiBaseUrl: string): FormPost =>
  async (path, form): Promise<FormAnswer> => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-olympus-client": CLIENT_ID,
      },
      body: formBody(form),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // A proxy's HTML error page, or an empty body. Keeping the text is what
      // lets the screen show what actually came back.
    }
    return {
      status: response.status,
      body,
      headers: {
        "retry-after": response.headers.get("retry-after") ?? undefined,
      },
    };
  };

export type SignInOutcome =
  | { outcome: "signed-in"; tokens: SavedTokens }
  /** The sheet was dismissed. Not a failure, and not worth an error. */
  | { outcome: "cancelled" }
  | { outcome: "refused"; reason: string };

/**
 * The sign-in, as a native app has to do it (RFC 8252).
 *
 * `openAuthSessionAsync` is `ASWebAuthenticationSession` on iOS: the system
 * browser, sharing Safari's cookies unless `preferEphemeralSession` says
 * otherwise, and returning to the custom scheme the API registered. An
 * embedded WebView would be able to read what the person types into Google,
 * which is why RFC 8252 §8.12 forbids one.
 *
 * `state` is checked here because nobody else can: the API returns it
 * untouched, and comparing it is the client's own half of the bargain.
 */
export const signIn = async (options: {
  apiBaseUrl: string;
  provider?: string;
  ephemeral: boolean;
  deviceName: string;
}): Promise<SignInOutcome> => {
  const provider = options.provider ?? PROVIDER;
  const pkce = createPkce(expoCrypto);
  const verifier = await pkce.newVerifier();
  const state = await pkce.newState();

  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl(options.apiBaseUrl, {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      challenge: await pkce.challengeFor(verifier),
      state,
      provider,
    }),
    REDIRECT_URI,
    { preferEphemeralSession: options.ephemeral },
  );
  if (result.type !== "success") return { outcome: "cancelled" };

  const params = parseRedirect(result.url);
  if (params.error !== undefined) {
    // One code for every reason the API refuses: no such user, an unverified
    // address, a disabled one, or a declined consent screen. Which it was is
    // in the API's log, deliberately and only there.
    return {
      outcome: "refused",
      reason: `the sign-in came back as ${params.error}; the API's log says why`,
    };
  }
  if (params.state !== state) {
    return {
      outcome: "refused",
      reason:
        "the redirect carried another sign-in's state, so nothing was exchanged",
    };
  }
  if (params.code === undefined || params.code === "") {
    return { outcome: "refused", reason: "the redirect carried no code" };
  }

  // Sixty seconds, one attempt.
  const issued = await exchangeCode(formPoster(options.apiBaseUrl), {
    code: params.code,
    redirectUri: REDIRECT_URI,
    clientId: CLIENT_ID,
    verifier,
    deviceName: options.deviceName,
  });
  const sid = decodeToken(issued.accessToken).claims.sid;
  return {
    outcome: "signed-in",
    tokens: afterIssue(
      {
        apiBaseUrl: options.apiBaseUrl,
        clientId: CLIENT_ID,
        provider,
        ...(typeof sid === "string" ? { sessionId: sid } : {}),
      },
      issued,
    ),
  };
};
