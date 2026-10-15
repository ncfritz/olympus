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

import { CLIENT_ID, PROVIDER, REDIRECT_URI } from "../config";

/*
 * The sign-in as a native app does it (RFC 8252), the way the mobile tester
 * proved it: PKCE through `@ncfritz/olympus-auth-flow`, the system
 * authentication session (`ASWebAuthenticationSession`), and the code
 * exchanged over `fetch`. What differs is the client: `olympus-ios`.
 */

/** The platform's half of PKCE: randomness and SHA-256, as base64url. */
const expoCrypto: FlowCrypto = {
  randomBase64Url: async (bytes) =>
    encodeBase64Url(await Crypto.getRandomBytesAsync(bytes)),
  // expo-crypto gives padded base64, not base64url, so it is converted.
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
 * The token endpoint, form-encoded. Not through `@ncfritz/olympus-client`:
 * that carries an access token, and this is the call that issues one. It
 * still names itself with `X-Olympus-Client` (ADR 0017).
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
      // A proxy's HTML error page, or nothing: kept as text.
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
  /** The sheet was dismissed: not a failure. */
  | { outcome: "cancelled" }
  | { outcome: "refused"; reason: string };

export const signIn = async (options: {
  apiBaseUrl: string;
  deviceName: string;
}): Promise<SignInOutcome> => {
  const pkce = createPkce(expoCrypto);
  const verifier = await pkce.newVerifier();
  const state = await pkce.newState();

  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl(options.apiBaseUrl, {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      challenge: await pkce.challengeFor(verifier),
      state,
      provider: PROVIDER,
    }),
    REDIRECT_URI,
  );
  if (result.type !== "success") return { outcome: "cancelled" };

  const params = parseRedirect(result.url);
  if (params.error !== undefined) {
    // One code for every refusal; the API's log says which it was.
    return {
      outcome: "refused",
      reason: "Olympus didn't accept that account.",
    };
  }
  if (params.state !== state) {
    return {
      outcome: "refused",
      reason: "The sign-in came back for a different request. Try again.",
    };
  }
  if (params.code === undefined || params.code === "") {
    return { outcome: "refused", reason: "The sign-in came back empty." };
  }

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
        provider: PROVIDER,
        ...(typeof sid === "string" ? { sessionId: sid } : {}),
      },
      issued,
    ),
  };
};
