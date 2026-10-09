import {
  AuthApi,
  createOlympusClients,
  type OlympusClients,
} from "@ncfritz/olympus-client";
import {
  type FormPost,
  refreshTokens,
  type SavedTokens,
} from "@ncfritz/olympus-auth-flow";
import { accessTokenProvider } from "./accessToken";
import { TesterError } from "./errors";
import { formPoster } from "./http";

import type { Settings } from "./settings";
import { TokenStore } from "./tokenStore";

export type Tester = {
  settings: Settings;
  store: TokenStore;
  /** No access token: the token endpoint and anything public. */
  anonymous: OlympusClients;
  /** With the access token, refreshed when it has expired. */
  signedIn: OlympusClients;
  auth: AuthApi;
  /** A form-encoded POST, for the endpoint that speaks RFC 6749. */
  post: FormPost;
  /** The stored tokens, checked against the API being called. */
  tokens(): SavedTokens;
};

/**
 * Everything a command needs: two sets of clients, the tokens, and the
 * wrapper over the endpoints that describe the caller.
 *
 * Two sets because the token endpoint is public and the tokens are what it
 * hands out: sending an access token with a grant request would be noise, and
 * sending one with a refresh would attach the credential the call exists to
 * replace.
 */
export const createTester = (settings: Settings): Tester => {
  const store = new TokenStore(settings.tokensPath);
  const anonymous = createOlympusClients({
    baseUrl: settings.apiBaseUrl,
    clientName: settings.clientId,
  });
  const post = formPoster(anonymous);

  const signedIn = createOlympusClients({
    baseUrl: settings.apiBaseUrl,
    clientName: settings.clientId,
    auth: accessTokenProvider(
      store,
      (refreshToken) =>
        refreshTokens(post, { clientId: settings.clientId, refreshToken }),
      { stale: settings.stale, announce: (message) => console.log(message) },
    ),
  });

  return {
    settings,
    store,
    anonymous,
    signedIn,
    auth: new AuthApi(signedIn),
    post,
    tokens: () => {
      const saved = store.require();
      if (saved.apiBaseUrl !== settings.apiBaseUrl) {
        // Signing in to dev and then calling production with those tokens is
        // one flag away, and the failure it causes -- a 401 from an API that
        // never issued them -- looks like a broken API rather than a mistake.
        throw new TesterError(
          `these tokens were issued by ${saved.apiBaseUrl}, not ${settings.apiBaseUrl}: sign in again, or pass --api ${saved.apiBaseUrl}`,
        );
      }
      return saved;
    },
  };
};
